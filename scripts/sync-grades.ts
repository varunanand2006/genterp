/**
 * scripts/sync-grades.ts
 *
 * Fetches per-section grade distributions from PlanetTerp for every course
 * in our database and upserts them into the `grades` table.
 *
 * After syncing, backfills `avg_gpa` on the `courses` table from real data.
 *
 * Usage:
 *   pnpm tsx scripts/sync-grades.ts               # all courses
 *   pnpm tsx scripts/sync-grades.ts --course CMSC330  # single course
 *   pnpm tsx scripts/sync-grades.ts --dept CMSC    # one department
 *   pnpm tsx scripts/sync-grades.ts --dry-run      # fetch only, no writes
 *
 * Rate limits: 500ms between requests, max 2 concurrent (PlanetTerp policy).
 */

import { createClient } from "@supabase/supabase-js";
import pLimit from "p-limit";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ── Supabase client ───────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── PlanetTerp shapes ─────────────────────────────────────────────────────────

interface PlanetTerpGradeRow {
  course: string;
  professor: string;
  semester: string;
  section: string;
  "A+": number;
  A: number;
  "A-": number;
  "B+": number;
  B: number;
  "B-": number;
  "C+": number;
  C: number;
  "C-": number;
  "D+": number;
  D: number;
  "D-": number;
  F: number;
  W: number;
  Other: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLANETTERP_BASE = "https://planetterp.com/api/v1";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeAvgGpa(rows: PlanetTerpGradeRow[]): number | null {
  const gradePoints: Record<string, number> = {
    "A+": 4.0, A: 4.0, "A-": 3.7,
    "B+": 3.3, B: 3.0, "B-": 2.7,
    "C+": 2.3, C: 2.0, "C-": 1.7,
    "D+": 1.3, D: 1.0, "D-": 0.7,
    F: 0.0,
  };
  const gradeKeys = Object.keys(gradePoints) as (keyof typeof gradePoints)[];

  let totalPoints = 0;
  let totalStudents = 0;

  for (const row of rows) {
    for (const grade of gradeKeys) {
      const count = (row as unknown as Record<string, number>)[grade] ?? 0;
      totalPoints += count * gradePoints[grade];
      totalStudents += count;
    }
  }

  return totalStudents > 0 ? Math.round((totalPoints / totalStudents) * 1000) / 1000 : null;
}

async function fetchGrades(courseId: string): Promise<PlanetTerpGradeRow[]> {
  const url = `${PLANETTERP_BASE}/grades?course=${encodeURIComponent(courseId)}`;
  const res = await fetch(url);

  // 404 = course not in PlanetTerp — not an error
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${courseId}`);

  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data as PlanetTerpGradeRow[];
}

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun  = args.includes("--dry-run");
const courseArg = args.includes("--course") ? args[args.indexOf("--course") + 1] : null;
const deptArg   = args.includes("--dept")   ? args[args.indexOf("--dept")   + 1] : null;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[sync-grades] starting${dryRun ? " (dry run)" : ""}`);

  // 1. Load course IDs from our DB — paginate to bypass Supabase's 1000-row default limit
  const allCourseIds: string[] = [];
  const PAGE = 1000;
  let from = 0;

  while (true) {
    let dbQuery = supabase
      .from("courses")
      .select("course_id")
      .range(from, from + PAGE - 1);
    if (courseArg) dbQuery = dbQuery.eq("course_id", courseArg.toUpperCase());
    if (deptArg)   dbQuery = dbQuery.eq("dept_id",   deptArg.toUpperCase());

    const { data: pageRows, error: dbError } = await dbQuery;
    if (dbError) {
      console.error("[sync-grades] failed to load courses:", dbError.message);
      process.exit(1);
    }
    if (!pageRows || pageRows.length === 0) break;
    allCourseIds.push(...pageRows.map((r) => r.course_id));
    if (pageRows.length < PAGE) break;
    from += PAGE;
  }

  const courseIds = allCourseIds;
  console.log(`[sync-grades] ${courseIds.length} courses to process`);

  // 2. Fetch + upsert with concurrency limit
  const limit = pLimit(2);
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const gpaUpdates: { course_id: string; avg_gpa: number }[] = [];

  const tasks = courseIds.map((courseId, i) =>
    limit(async () => {
      // Stagger to respect 500ms rate limit
      await delay(i === 0 ? 0 : 500);

      let rows: PlanetTerpGradeRow[];
      try {
        rows = await fetchGrades(courseId);
      } catch (err) {
        console.warn(`[sync-grades] fetch failed: ${courseId} —`, (err as Error).message);
        failed++;
        return;
      }

      if (rows.length === 0) {
        skipped++;
        return;
      }

      // Compute avg GPA from raw data
      const avg = computeAvgGpa(rows);
      if (avg !== null) {
        gpaUpdates.push({ course_id: courseId, avg_gpa: avg });
      }

      if (dryRun) {
        console.log(`[dry-run] ${courseId}: ${rows.length} rows, avg_gpa=${avg ?? "n/a"}`);
        synced += rows.length;
        return;
      }

      // Upsert grade rows — skip rows where professor is null (staff/TBD sections)
      const upsertRows = rows.filter((r) => r.professor != null).map((r) => ({
        course_id:  courseId,
        professor:  r.professor,
        semester:   r.semester,
        section:    r.section,
        a_plus:     r["A+"]  ?? 0,
        a:          r["A"]   ?? 0,
        a_minus:    r["A-"]  ?? 0,
        b_plus:     r["B+"]  ?? 0,
        b:          r["B"]   ?? 0,
        b_minus:    r["B-"]  ?? 0,
        c_plus:     r["C+"]  ?? 0,
        c:          r["C"]   ?? 0,
        c_minus:    r["C-"]  ?? 0,
        d_plus:     r["D+"]  ?? 0,
        d:          r["D"]   ?? 0,
        d_minus:    r["D-"]  ?? 0,
        f:          r["F"]   ?? 0,
        w:          r["W"]   ?? 0,
        other:      r["Other"] ?? 0,
      }));

      const { error: upsertError } = await supabase
        .from("grades")
        .upsert(upsertRows, { onConflict: "course_id,professor,semester,section" });

      if (upsertError) {
        console.warn(`[sync-grades] upsert failed: ${courseId} —`, upsertError.message);
        failed++;
      } else {
        synced += rows.length;
        if (synced % 500 === 0) {
          console.log(`[sync-grades] ${synced} rows synced so far…`);
        }
      }
    })
  );

  await Promise.all(tasks);

  // 3. Backfill avg_gpa on courses table
  if (!dryRun && gpaUpdates.length > 0) {
    console.log(`[sync-grades] backfilling avg_gpa for ${gpaUpdates.length} courses…`);
    for (const { course_id, avg_gpa } of gpaUpdates) {
      await supabase.from("courses").update({ avg_gpa }).eq("course_id", course_id);
    }
  }

  console.log(`[sync-grades] done — ${synced} rows synced, ${skipped} courses not in PlanetTerp, ${failed} failures`);
}

main().catch((err) => {
  console.error("[sync-grades] fatal:", err);
  process.exit(1);
});
