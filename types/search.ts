export interface CourseResult {
  course_id: string;
  title: string;
  dept_id: string;
  credits: number | null;
  gen_ed_tags: string[];
  avg_gpa: number | null;
  has_ai_summary: boolean;
  sections_count: number;
  open_sections_count: number;
}

export interface SearchResponse {
  courses: CourseResult[];
  pagination: {
    page: number;
    total_pages: number;
    total_results: number;
  };
}
