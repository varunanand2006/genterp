import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseBoolean, evaluateBoolean, BooleanAST } from "@/lib/search/parse-boolean";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface SectionRow {
  seats_open: number;
}

interface CourseRow {
  course_id: string;
  title: string;
  dept_id: string;
  credits: number | null;
  gen_ed_tags: string[];
  gen_ed_raw: string[][];
  avg_gpa: number | null;
  ai_summary: unknown;
  sections: SectionRow[];
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const q       = searchParams.get("q")?.trim() ?? "";
  const genEds  = searchParams.get("gen_eds")?.trim() ?? "";
  const dept    = searchParams.get("dept")?.trim().toUpperCase() ?? "";
  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
  const page    = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  // Parse and validate the boolean expression up front so we can return a
  // 400 before touching the database.
  let genEdAST: BooleanAST | null = null;
  let allTags:  string[]          = [];

  if (genEds) {
    try {
      const parsed = parseBoolean(genEds);
      genEdAST = parsed.ast;
      allTags  = parsed.allTags;
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid expression", details: (err as Error).message },
        { status: 400 }
      );
    }
  }

  const supabase = createClient();

  // ── Build DB query ──────────────────────────────────────────────────────────
  //
  // We fetch gen_ed_raw alongside the other columns so the JS post-filter can
  // run the precise AND co-occurrence check. Only seats_open is needed from
  // sections to compute open_sections_count.

  let query = supabase
    .from("courses")
    .select("course_id, title, dept_id, credits, gen_ed_tags, gen_ed_raw, avg_gpa, ai_summary, sections(seats_open)");

  if (dept) {
    query = query.eq("dept_id", dept);
  }

  if (q) {
    // Case-insensitive substring match against title.
    query = query.ilike("title", `%${q}%`);
  }

  if (allTags.length > 0) {
    // GIN pre-filter: course must share at least one tag with the expression.
    // This uses the GIN index on gen_ed_tags (TEXT[]) via the && operator.
    query = query.overlaps("gen_ed_tags", allTags);
  }

  const { data, error } = await query.returns<CourseRow[]>();

  if (error) {
    console.error("[api/search] DB error:", error.message);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const rows = data ?? [];

  // ── JS post-filter for precise GenEd boolean semantics ─────────────────────
  //
  // The GIN pre-filter guarantees the course has at least one relevant tag.
  // evaluateBoolean enforces the exact boolean structure — critically, AND
  // requires all tags to appear in the SAME inner array (one GenEd group),
  // not merely anywhere in the flat tag list.

  const filtered = genEdAST
    ? rows.filter((r) => evaluateBoolean(genEdAST!, r.gen_ed_raw ?? []))
    : rows;

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalResults = filtered.length;
  const totalPages   = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const safePage     = Math.min(page, totalPages);
  const offset       = (safePage - 1) * PAGE_SIZE;
  const pageSlice    = filtered.slice(offset, offset + PAGE_SIZE);

  // ── Shape the response ──────────────────────────────────────────────────────
  //
  // Strip gen_ed_raw (internal) and ai_summary (too large for list view).
  // Derive has_ai_summary, sections_count, and open_sections_count here.

  const courses = pageSlice.map((r) => ({
    course_id:           r.course_id,
    title:               r.title,
    dept_id:             r.dept_id,
    credits:             r.credits,
    gen_ed_tags:         r.gen_ed_tags ?? [],
    avg_gpa:             r.avg_gpa,
    has_ai_summary:      r.ai_summary != null,
    sections_count:      r.sections.length,
    open_sections_count: r.sections.filter((s) => s.seats_open > 0).length,
  }));

  return NextResponse.json({
    courses,
    pagination: {
      page:          safePage,
      total_pages:   totalPages,
      total_results: totalResults,
    },
  });
}
