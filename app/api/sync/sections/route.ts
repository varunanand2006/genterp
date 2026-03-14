import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTimeToMilitary } from "@/lib/sync/time-parser";

// ── umd.io shapes ────────────────────────────────────────────────────────────

interface UmdMeeting {
  days: string;
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  classtype: string | null;
}

interface UmdSection {
  section_id: string;
  course: string;           // renamed → course_id
  instructors: string[];
  seats: string;            // parseInt → seats_total
  open_seats: string;       // parseInt → seats_open
  waitlist: string;         // parseInt → waitlist_count
  meetings: UmdMeeting[];
  semester: number;
}

// ── normalized meeting shape stored in DB ────────────────────────────────────

interface NormalizedMeeting {
  days: string;
  start: number | null;
  end: number | null;
  room: string | null;
  type: string;
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
  return semesters[0];
}

function normalizeMeeting(m: UmdMeeting): NormalizedMeeting {
  const building = m.building?.trim();
  const room = m.room?.trim();

  return {
    days: m.days ?? "",
    start: parseTimeToMilitary(m.start_time),
    end: parseTimeToMilitary(m.end_time),
    // Combine building + room into a single string; null if either is missing
    room: building && room ? `${building} ${room}` : null,
    type: m.classtype?.trim() || "Lecture",
  };
}

function transformSection(raw: UmdSection) {
  return {
    section_id: raw.section_id,
    course_id: raw.course,
    instructors: raw.instructors ?? [],
    seats_total: parseInt(raw.seats, 10),
    seats_open: parseInt(raw.open_seats, 10),
    waitlist_count: parseInt(raw.waitlist, 10),
    meetings: (raw.meetings ?? []).map(normalizeMeeting),
    semester: String(raw.semester),
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
    .insert({ sync_type: "sections", status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();

  if (logInsertError || !logEntry) {
    return NextResponse.json(
      { error: "Failed to create sync_log entry", detail: logInsertError?.message },
      { status: 500 }
    );
  }

  const logId: number = logEntry.id;

  // 3. Fetch latest semester
  let semester: string;
  try {
    semester = await fetchLatestSemester();
  } catch (err) {
    await supabase
      .from("sync_log")
      .update({ status: "failed", finished_at: new Date().toISOString(), error_message: String(err) })
      .eq("id", logId);
    return NextResponse.json({ error: "Failed to fetch semesters", detail: String(err) }, { status: 502 });
  }

  // 4. Paginate through sections
  let page = 1;
  let totalSynced = 0;
  let skippedPages = 0;

  while (true) {
    if (page > 1) await delay(200);

    let sections: UmdSection[];
    try {
      const res = await fetch(
        `${UMD_BASE}/courses/sections?semester=${semester}&per_page=100&page=${page}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sections = await res.json();
    } catch (err) {
      console.error(`[sync/sections] page ${page} fetch failed:`, err);
      skippedPages++;
      page++;
      if (page > 500) break; // hard safety cap — sections outnumber courses
      continue;
    }

    if (!sections.length) break;

    const rows = sections.map(transformSection);

    const { error: upsertError } = await supabase
      .from("sections")
      .upsert(rows, { onConflict: "section_id" });

    if (upsertError) {
      console.error(`[sync/sections] page ${page} upsert failed:`, upsertError.message);
      skippedPages++;
    } else {
      totalSynced += rows.length;
    }

    page++;
  }

  // 5. Update sync_log
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
