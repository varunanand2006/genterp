"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/search/CourseCard";
import type { CourseResult } from "@/types/search";

interface CourseListProps {
  courses: CourseResult[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalResults: number;
  semester: string;
  onPageChange: (page: number) => void;
}

function CourseCardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-3 w-3" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-4 w-10 rounded-full" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function CourseList({
  courses,
  loading,
  page,
  totalPages,
  totalResults,
  semester,
  onPageChange,
}: CourseListProps) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No courses found.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {/* Result count */}
      <p className="text-xs text-muted-foreground px-1">
        {totalResults} course{totalResults !== 1 ? "s" : ""} found
      </p>

      {/* Cards */}
      {courses.map((course) => (
        <CourseCard key={course.course_id} course={course} semester={semester} />
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
