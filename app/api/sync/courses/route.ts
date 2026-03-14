import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flattenGenEdTags } from "@/lib/sync/gen-ed-flattener";

// ── umd.io shapes ────────────────────────────────────────────────────────────

interface UmdCourse {
  course_id: string;
  name: string;
  dept_id: string;
  department: string;
  credits: string;
  description: string;
  gen_ed: string[][];
  relationships: Record<string, unknown>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const UMD_BASE = "https://api.umd.io/v1";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLatestSemester(): Promise<string> {
  const res = await fetch(`${UMD_BASE}/courses/semesters`);
  if (!res.ok) throw new Error(`semesters fetch failed: ${res.status}`);
  const semesters: string[] = await res.json();
  if (!semesters.length) throw new Error("semesters array is empty");
  // umd.io returns semesters in ascending order — last entry is the latest
  return semesters[semesters.length - 1];
}

function transformCourse(raw: UmdCourse) {
  return {
    course_id: raw.course_id,
    title: raw.name,
    dept_id: raw.dept_id,
    department: raw.department,
    credits: parseInt(raw.credits, 10),
    description: raw.description ?? null,
    gen_ed_raw: raw.gen_ed ?? [],
    gen_ed_tags: flattenGenEdTags(raw.gen_ed ?? []),
    relationships: raw.relationships ?? {},
    last_synced: new Date().toISOString(),
  };
}

// ── route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth check
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  // 2. Create sync_log entry
  const { data: logEntry, error: logInsertError } = await supabase
    .from("sync_log")
    .insert({ sync_type: "courses", status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();

  if (logInsertError || !logEntry) {
    return NextResponse.json(
      { error: "Failed to create sync_log entry", detail: logInsertError?.message },
      { status: 500 }
    );
  }

  const logId: number = logEntry.id;

  // 3. Resolve semester — body may override auto-detection
  const body = await req.json().catch(() => ({})) as { semester?: string };

  let semester: string;
  try {
    semester = body.semester?.trim() || await fetchLatestSemester();
  } catch (err) {
    await supabase
      .from("sync_log")
      .update({ status: "failed", finished_at: new Date().toISOString(), error_message: String(err) })
      .eq("id", logId);
    return NextResponse.json({ error: "Failed to fetch semesters", detail: String(err) }, { status: 502 });
  }

  // 4. Paginate through courses
  let page = 1;
  let totalSynced = 0;
  let skippedPages = 0;

  while (true) {
    // 200ms delay between pages (skip before first page)
    if (page > 1) await delay(200);

    let courses: UmdCourse[];
    try {
      const res = await fetch(
        `${UMD_BASE}/courses?semester=${semester}&per_page=100&page=${page}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      courses = await res.json();
    } catch (err) {
      // 9. Page failure: log and continue
      console.error(`[sync/courses] page ${page} fetch failed:`, err);
      skippedPages++;
      page++;
      // Stop pagination if we get two consecutive failures on the first page
      // or if we've already seen data (empty page signals end of results)
      if (page > 200) break; // hard safety cap
      continue;
    }

    // Empty page signals end of pagination
    if (!courses.length) break;

    // 5. Transform
    const rows = courses.map(transformCourse);

    // 6. Batch upsert
    const { error: upsertError } = await supabase
      .from("courses")
      .upsert(rows, { onConflict: "course_id" });

    if (upsertError) {
      console.error(`[sync/courses] page ${page} upsert failed:`, upsertError.message);
      skippedPages++;
    } else {
      totalSynced += rows.length;
    }

    page++;
  }

  // 8. Update sync_log with final status
  const finalStatus = skippedPages === 0 ? "success" : "partial";
  await supabase
    .from("sync_log")
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      records_synced: totalSynced,
      ...(skippedPages > 0 && {
        error_message: `${skippedPages} page(s) skipped due to errors`,
      }),
    })
    .eq("id", logId);

  return NextResponse.json({
    status: finalStatus,
    semester,
    records_synced: totalSynced,
    pages_skipped: skippedPages,
  });
}
