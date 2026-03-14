"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AISummaryDisplay } from "@/components/search/AISummary";
import { cn } from "@/lib/utils";
import { useScheduleStore } from "@/store/schedule";
import type { CourseResult } from "@/types/search";
import type { CourseDetail } from "@/types/course";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(military: number | null): string {
  if (military === null) return "TBA";
  const h = Math.floor(military / 100);
  const m = military % 100;
  const period = h >= 12 ? "pm" : "am";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")}${period}`;
}

function formatMeetingCompact(days: string, start: number | null, end: number | null): string {
  if (start === null && end === null) return "Async";
  return `${days} ${formatTime(start)}–${formatTime(end)}`;
}

// ── Section table row ─────────────────────────────────────────────────────────

interface SectionTableRowProps {
  section: CourseDetail["sections"][number];
  courseId: string;
  courseTitle: string;
  semester: string;
}

function SectionTableRow({ section, courseId, courseTitle, semester }: SectionTableRowProps) {
  const { pin, unpin, isPinned } = useScheduleStore();
  const pinned = isPinned(section.section_id, semester);

  const hasOpen = section.seats_open > 0;
  const meeting = section.is_async
    ? "Async"
    : section.meetings[0]
    ? formatMeetingCompact(section.meetings[0].days, section.meetings[0].start, section.meetings[0].end)
    : "TBA";

  function handlePin(e: React.MouseEvent) {
    e.stopPropagation();
    if (pinned) {
      unpin(section.section_id, semester);
    } else {
      pin({ section, course_id: courseId, course_title: courseTitle, semester });
    }
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-2 px-2 py-1.5 rounded border border-border text-xs">
      <span className="font-mono text-muted-foreground shrink-0">
        {section.section_id.split("-")[1] ?? section.section_id}
      </span>
      <span className="truncate text-muted-foreground">
        {section.instructors[0] ?? "TBA"}
      </span>
      <span className="shrink-0 text-muted-foreground">{meeting}</span>
      <span className={cn("shrink-0 font-medium tabular-nums", hasOpen ? "text-green-600 dark:text-green-400" : "text-destructive")}>
        {section.seats_open}/{section.seats_total}
      </span>
      <Button
        size="sm"
        variant={pinned ? "default" : "outline"}
        className="h-5 px-1.5 text-[10px] leading-none"
        onClick={handlePin}
      >
        {pinned ? "Pinned" : "Pin"}
      </Button>
    </div>
  );
}

// ── Expanded detail skeleton ──────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-2 pt-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-16 w-full mt-1" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CourseCardProps {
  course: CourseResult;
  semester: string;
}

export function CourseCard({ course, semester }: CourseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Lazy-fetch full course detail on first expand; re-fetch if semester changes.
  useEffect(() => {
    if (!expanded) return;
    setDetail(null);
    setDetailLoading(true);
    const url = `/api/course/${course.course_id}${semester ? `?semester=${semester}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: CourseDetail) => setDetail(d))
      .finally(() => setDetailLoading(false));
  }, [expanded, semester, course.course_id]);

  const hasOpenSections = course.open_sections_count > 0;

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg border border-border px-3 py-2 space-y-0.5 transition-colors hover:bg-accent/50",
        expanded && "bg-accent/30"
      )}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Row 1: course ID, title, chevron */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs text-muted-foreground shrink-0">
            {course.course_id}
          </span>
          <span className="text-sm font-semibold truncate">{course.title}</span>
        </div>
        <span className={cn("shrink-0 text-muted-foreground text-xs transition-transform", expanded && "rotate-180")}>
          ▾
        </span>
      </div>

      {/* Row 2: metadata left, GenEd tags right */}
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Left: dept, credits, seats, GPA, AI */}
        <span className="text-xs text-muted-foreground shrink-0">{course.dept_id}</span>
        {course.credits != null && (
          <span className="text-xs text-muted-foreground shrink-0">{course.credits}cr</span>
        )}
        <span className={cn("text-xs font-medium shrink-0", hasOpenSections ? "text-green-600 dark:text-green-400" : "text-destructive")}>
          {hasOpenSections ? `${course.open_sections_count}/${course.sections_count} open` : "CLOSED"}
        </span>
        {course.avg_gpa != null && (
          <span className="text-xs text-muted-foreground shrink-0">{course.avg_gpa.toFixed(2)} GPA</span>
        )}
        {course.has_ai_summary && (
          <span className="text-xs text-primary font-medium shrink-0">AI ✦</span>
        )}

        {/* Right: GenEd tags pushed to the end */}
        {course.gen_ed_tags.length > 0 && (
          <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
            {course.gen_ed_tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0 h-4 leading-none">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="pt-2 border-t border-border space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          {detailLoading && <DetailSkeleton />}

          {detail && (
            <>
              {/* Description */}
              {detail.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {detail.description}
                </p>
              )}

              {/* Prerequisites */}
              {detail.relationships?.prereqs && (
                <p className="text-xs">
                  <span className="font-medium text-foreground">Prerequisites: </span>
                  <span className="text-muted-foreground">{detail.relationships.prereqs}</span>
                </p>
              )}

              {/* AI Summary */}
              <AISummaryDisplay summary={detail.ai_summary} />

              {/* Sections */}
              {detail.sections.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Sections
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {course.open_sections_count} open / {course.sections_count} total
                    </span>
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detail.sections.map((s) => (
                      <SectionTableRow
                        key={s.section_id}
                        section={s}
                        courseId={course.course_id}
                        courseTitle={course.title}
                        semester={semester}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Link */}
              <Link
                href={`/course/${course.course_id}`}
                className="inline-block text-xs text-primary hover:underline"
              >
                View full details →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
