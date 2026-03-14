"use client";

import { useScheduleStore } from "@/store/schedule";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTime(military: number | null): string {
  if (military === null) return "TBA";
  const h = Math.floor(military / 100);
  const m = military % 100;
  const period = h >= 12 ? "pm" : "am";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")}${period}`;
}

export function PinnedList({ semester }: { semester: string }) {
  const { pinned, unpin } = useScheduleStore();
  const items = Object.values(pinned).filter((p) => p.semester === semester);

  if (items.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">No sections pinned yet.</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Expand a course and click Pin.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5 p-4">
      {items.map(({ section, course_id, course_title, semester }) => {
        const hasOpen = section.seats_open > 0;
        const m = section.is_async
          ? "Async"
          : section.meetings[0]
          ? `${section.meetings[0].days} ${formatTime(section.meetings[0].start)}–${formatTime(section.meetings[0].end)}`
          : "TBA";

        return (
          <li
            key={`${section.section_id}::${semester}`}
            className="rounded-md border border-border bg-background px-3 py-2 text-xs space-y-0.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-muted-foreground">
                  {course_id}
                </span>{" "}
                <span className="font-semibold truncate">{course_title}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => unpin(section.section_id, semester)}
                aria-label="Unpin"
              >
                ✕
              </Button>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono">
                {section.section_id.split("-")[1] ?? section.section_id}
              </span>
              <span>{m}</span>
              {section.instructors[0] && <span>{section.instructors[0]}</span>}
              <span
                className={cn(
                  "ml-auto font-medium tabular-nums",
                  hasOpen
                    ? "text-green-600 dark:text-green-400"
                    : "text-destructive"
                )}
              >
                {section.seats_open}/{section.seats_total}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
