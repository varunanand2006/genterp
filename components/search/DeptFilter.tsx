"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DeptFilterProps {
  onSelect: (dept: string) => void;
}

export function DeptFilter({ onSelect }: DeptFilterProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    onSelect(value.trim().toUpperCase());
  }

  return (
    <div className="relative">
      <Input
        placeholder="e.g. CMSC, ENEE, CMSC4XX"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        className="h-8 pr-8 text-sm"
      />
      <button
        onClick={handleSubmit}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Filter by department"
        tabIndex={-1}
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  );
}
