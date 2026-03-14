"use client";

import { cn } from "@/lib/utils";
import { getSemesterOptions } from "@/lib/semester";

const options = getSemesterOptions();

interface SemesterPickerProps {
  value: string;
  onChange: (semester: string) => void;
}

export function SemesterPicker({ value, onChange }: SemesterPickerProps) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden text-xs">
      {options.map((opt, i) => (
        <button
          key={opt.code}
          onClick={() => onChange(opt.code)}
          className={cn(
            "flex-1 px-2 py-1.5 transition-colors",
            i > 0 && "border-l border-border",
            value === opt.code
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
