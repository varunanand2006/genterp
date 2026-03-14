import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDefaultSemesterCode } from "@/lib/semester";
import { CourseSemesterPicker } from "@/components/search/CourseSemesterPicker";
import type { CourseDetail, Section, CourseRelationships } from "@/types/course";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(military: number | null): string {
  if (military === null) return "TBA";
  const h = Math.floor(military / 100);
  const m = military % 100;
  const period = h >= 12 ? "pm" : "am";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")}${period}`;
}

function formatDays(days: string): string {
  return days
    .replace(/M/g, "Mon ")
    .replace(/Tu/g, "Tue ")
    .replace(/W/g, "Wed ")
    .replace(/Th/g, "Thu ")
    .replace(/F/g, "Fri ")
    .trim();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionRow({ section }: { section: Section }) {
  const hasOpen = section.seats_open > 0;

  return (
    <div className="rounded-md border border-border p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium">{section.section_id}</span>
        <span
          className={cn(
            "text-xs font-medium",
            hasOpen ? "text-green-600 dark:text-green-400" : "text-destructive"
          )}
        >
          {section.seats_open}/{section.seats_total} open
          {section.waitlist_count > 0 && ` · ${section.waitlist_count} waitlist`}
        </span>
      </div>

      {section.instructors.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {section.instructors.join(", ")}
        </p>
      )}

      {section.is_async ? (
        <p className="text-xs text-muted-foreground italic">Asynchronous / No set meeting time</p>
      ) : (
        <div className="space-y-0.5">
          {section.meetings.map((m, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {formatDays(m.days)} · {formatTime(m.start)}–{formatTime(m.end)}
              {m.room && ` · ${m.room}`}
              {m.type !== "Lecture" && ` (${m.type})`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipsSection({ rel }: { rel: CourseRelationships }) {
  const entries: [string, string | null][] = [
    ["Prerequisites", rel.prereqs],
    ["Corequisites", rel.coreqs],
    ["Restrictions", rel.restrictions],
    ["Credit granted for", rel.credit_granted_for],
    ["Formerly", rel.formerly],
    ["Also offered as", rel.also_offered_as],
    ["Additional info", rel.additional_info],
  ];

  const visible = entries.filter(([, v]) => v);
  if (!visible.length) return null;

  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-semibold">Requirements & Notes</h2>
      <dl className="space-y-1">
        {visible.map(([label, value]) => (
          <div key={label} className="text-sm">
            <dt className="inline font-medium text-foreground">{label}: </dt>
            <dd className="inline text-muted-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semester?: string }>;
}) {
  const [{ id }, { semester: semesterParam }] = await Promise.all([params, searchParams]);
  const semester = semesterParam?.trim() || getDefaultSemesterCode();
  const supabase = createClient();

  const [courseResult, sectionsResult] = await Promise.all([
    supabase.from("courses").select("*").eq("course_id", id).single(),
    supabase
      .from("sections")
      .select("section_id, instructors, seats_open, seats_total, waitlist_count, meetings")
      .eq("course_id", id)
      .eq("semester", semester)
      .order("section_id"),
  ]);

  if (courseResult.error?.code === "PGRST116" || !courseResult.data) {
    notFound();
  }

  if (courseResult.error) {
    throw new Error(courseResult.error.message);
  }

  const raw = courseResult.data;
  const rawSections = sectionsResult.data ?? [];

  const course: CourseDetail = {
    course_id: raw.course_id,
    title: raw.title,
    dept_id: raw.dept_id,
    department: raw.department ?? null,
    credits: raw.credits ?? null,
    description: raw.description ?? null,
    gen_ed_tags: raw.gen_ed_tags ?? [],
    avg_gpa: raw.avg_gpa ?? null,
    professors: raw.professors ?? [],
    ai_summary: raw.ai_summary ?? null,
    relationships: raw.relationships ?? null,
    sections: rawSections.map((s: {
      section_id: string;
      instructors: string[];
      seats_open: number;
      seats_total: number;
      waitlist_count: number;
      meetings: Section["meetings"];
    }) => ({
      ...s,
      is_async:
        s.meetings.length === 0 ||
        s.meetings.every((m) => m.start === null && m.end === null),
    })),
    last_synced: raw.last_synced,
  };

  const openSections = course.sections.filter((s) => s.seats_open > 0).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Back + semester picker */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to search
          </Link>
          <CourseSemesterPicker courseId={course.course_id} semester={semester} />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{course.course_id}</span>
            {course.credits != null && (
              <Badge variant="outline">{course.credits} credits</Badge>
            )}
            {course.gen_ed_tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
          <p className="text-sm text-muted-foreground">
            {course.department ?? course.dept_id}
            {course.avg_gpa != null && ` · Avg GPA ${course.avg_gpa.toFixed(2)}`}
          </p>
        </div>

        {/* Description */}
        {course.description && (
          <section className="space-y-1.5">
            <h2 className="text-sm font-semibold">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
          </section>
        )}

        {/* Relationships */}
        {course.relationships && (
          <RelationshipsSection rel={course.relationships} />
        )}

        {/* Sections */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Sections
            <span className="ml-2 font-normal text-muted-foreground">
              {openSections} open / {course.sections.length} total
            </span>
          </h2>
          {course.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections available.</p>
          ) : (
            <div className="space-y-2">
              {course.sections.map((s) => (
                <SectionRow key={s.section_id} section={s} />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Last synced {new Date(course.last_synced).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
