"use client";

import { useRouter } from "next/navigation";
import { SemesterPicker } from "@/components/search/SemesterPicker";

interface CourseSemesterPickerProps {
  courseId: string;
  semester: string;
}

export function CourseSemesterPicker({ courseId, semester }: CourseSemesterPickerProps) {
  const router = useRouter();

  return (
    <SemesterPicker
      value={semester}
      onChange={(s) => router.push(`/course/${courseId}?semester=${s}`)}
    />
  );
}
