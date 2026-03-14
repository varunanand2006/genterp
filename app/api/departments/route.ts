import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("courses")
    .select("dept_id")
    .order("dept_id");

  if (error) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const depts = [...new Set((data ?? []).map((r: { dept_id: string }) => r.dept_id))];
  return NextResponse.json({ departments: depts });
}
