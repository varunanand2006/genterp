import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface MeetingRow {
  days: string;
  start: number | null;
  end: number | null;
  room: string | null;
  type: string;
}

interface SectionRow {
  section_id:     string;
  instructors:    string[];
  seats_open:     number;
  seats_total:    number;
  waitlist_count: number;
  meetings:       MeetingRow[];
}

interface CourseRow {
  course_id:    string;
  title:        string;
  dept_id:      string;
  department:   string | null;
  credits:      number | null;
  description:  string | null;
  gen_ed_tags:  string[];
  gen_ed_raw:   string[][];
  avg_gpa:      number | null;
  professors:   string[];
  ai_summary:   unknown;
  relationships: {
    prereqs:           string | null;
    coreqs:            string | null;
    restrictions:      string | null;
    credit_granted_for: string | null;
    formerly:          string | null;
    also_offered_as:   string | null;
    additional_info:   string | null;
  } | null;
  last_synced:  string;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const semester = req.nextUrl.searchParams.get("semester")?.trim() ?? "";

  if (!id) {
    return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
  }

  const supabase = createClient();

  // Build sections query — filter by semester when provided.
  const sectionsBase = supabase
    .from("sections")
    .select("section_id, instructors, seats_open, seats_total, waitlist_count, meetings")
    .eq("course_id", id);
  const sectionsQuery = (semester ? sectionsBase.eq("semester", semester) : sectionsBase)
    .order("section_id");

  // Fetch course and sections in parallel — they are independent queries.
  const [courseResult, sectionsResult] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("course_id", id)
      .single<CourseRow>(),
    sectionsQuery.returns<SectionRow[]>(),
  ]);

  if (courseResult.error) {
    // PostgREST returns error code PGRST116 when .single() finds no rows.
    if (courseResult.error.code === "PGRST116") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    console.error("[api/course] DB error (course):", courseResult.error.message);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  if (sectionsResult.error) {
    console.error("[api/course] DB error (sections):", sectionsResult.error.message);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const course  = courseResult.data;
  const rawSections = sectionsResult.data ?? [];

  // ── Derive is_async ─────────────────────────────────────────────────────────
  //
  // A section is async when it has no scheduled meeting times at all — either
  // its meetings array is empty, or every meeting has null start and end.
  // (A section with meetings but no times is TBA, treated the same as async.)

  const sections = rawSections.map((s) => ({
    section_id:     s.section_id,
    instructors:    s.instructors,
    seats_open:     s.seats_open,
    seats_total:    s.seats_total,
    waitlist_count: s.waitlist_count,
    meetings:       s.meetings,
    is_async:
      s.meetings.length === 0 ||
      s.meetings.every((m) => m.start === null && m.end === null),
  }));

  return NextResponse.json({
    course_id:     course.course_id,
    title:         course.title,
    dept_id:       course.dept_id,
    department:    course.department,
    credits:       course.credits,
    description:   course.description,
    gen_ed_tags:   course.gen_ed_tags  ?? [],
    gen_ed_raw:    course.gen_ed_raw   ?? [],
    avg_gpa:       course.avg_gpa,
    professors:    course.professors   ?? [],
    ai_summary:    course.ai_summary   ?? null,
    relationships: course.relationships ?? null,
    sections,
    last_synced:   course.last_synced,
  });
}
