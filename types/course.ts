export interface Meeting {
  days: string;
  start: number | null;
  end: number | null;
  room: string | null;
  type: string;
}

export interface Section {
  section_id: string;
  instructors: string[];
  seats_open: number;
  seats_total: number;
  waitlist_count: number;
  meetings: Meeting[];
  is_async: boolean;
}

export interface CourseRelationships {
  prereqs: string | null;
  coreqs: string | null;
  restrictions: string | null;
  credit_granted_for: string | null;
  formerly: string | null;
  also_offered_as: string | null;
  additional_info: string | null;
}

export interface CourseDetail {
  course_id: string;
  title: string;
  dept_id: string;
  department: string | null;
  credits: number | null;
  description: string | null;
  gen_ed_tags: string[];
  avg_gpa: number | null;
  professors: string[];
  ai_summary: import("./ai-summary").AISummary | null;
  relationships: CourseRelationships | null;
  sections: Section[];
  last_synced: string;
}
