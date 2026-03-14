"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { CourseList } from "@/components/search/CourseList";
import { DeptFilter } from "@/components/search/DeptFilter";
import { SemesterPicker } from "@/components/search/SemesterPicker";
import { getDefaultSemesterCode } from "@/lib/semester";
import { useScheduleStore } from "@/store/schedule";
import { PinnedList } from "@/components/calendar/PinnedList";
import { WeekView } from "@/components/calendar/WeekView";
import type { CourseResult, SearchResponse } from "@/types/search";

export default function Home() {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [semester, setSemester] = useState(getDefaultSemesterCode);
  const [courses, setCourses] = useState<CourseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const fetchCourses = useCallback(async (q: string, d: string, sem: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q.trim()) params.set("gen_eds", q);
      if (d) params.set("dept", d);
      if (sem) params.set("semester", sem);
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) return;
      const data: SearchResponse = await res.json();
      setCourses(data.courses);
      setTotalPages(data.pagination.total_pages);
      setTotalResults(data.pagination.total_results);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when query, dept, or semester changes (reset to page 1)
  useEffect(() => {
    setPage(1);
    fetchCourses(query, dept, semester, 1);
  }, [query, dept, semester, fetchCourses]);

  // Re-fetch when page changes
  useEffect(() => {
    fetchCourses(query, dept, semester, page);
  }, [page, query, dept, semester, fetchCourses]);

  const pinnedCount = useScheduleStore((s) =>
    Object.values(s.pinned).filter((p) => p.semester === semester).length
  );

  const handleSearch = useCallback((q: string) => setQuery(q), []);
  const handleDept = useCallback((d: string) => setDept(d), []);
  const handleSemester = useCallback((s: string) => setSemester(s), []);
  const handlePageChange = useCallback((p: number) => setPage(p), []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top header — full width */}
      <header className="shrink-0 border-b border-border bg-background px-6 py-3 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">GenTerp</h1>
        <span className="text-muted-foreground text-sm">·</span>
        <p className="text-sm text-muted-foreground">UMD GenEd & Elective course finder</p>
      </header>

      {/* Content row */}
      <div className="flex flex-1 overflow-hidden">
      {/* Left panel — search */}
      <aside className="flex w-1/2 shrink-0 flex-col border-r border-border bg-background">
        {/* Search + filters */}
        <div className="border-b border-border p-4 space-y-2">
          <SemesterPicker value={semester} onChange={handleSemester} />
          <div className="flex items-start gap-2">
            <span className="w-14 shrink-0 pt-1.5 text-xs font-medium text-muted-foreground">Tags</span>
            <div className="flex-1"><SearchBar onSearch={handleSearch} /></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">Filters</span>
            <div className="flex-1"><DeptFilter onSelect={handleDept} /></div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          <CourseList
            courses={courses}
            loading={loading}
            page={page}
            totalPages={totalPages}
            totalResults={totalResults}
            semester={semester}
            onPageChange={handlePageChange}
          />
        </div>
      </aside>

      {/* Right panel */}

      <main className="flex flex-1 flex-col bg-muted/30 overflow-hidden">
        {/* Pinned sections */}
        <div className="border-b border-border bg-background">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold">
              Pinned
              {pinnedCount > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {pinnedCount} section{pinnedCount !== 1 ? "s" : ""}
                </span>
              )}
            </h2>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <PinnedList semester={semester} />
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-hidden">
          <WeekView />
        </div>
      </main>
      </div>
    </div>
  );
}
