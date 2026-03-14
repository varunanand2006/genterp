"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { parseBoolean } from "@/lib/search/parse-boolean";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(q: string): boolean {
    if (!q.trim()) {
      setError(null);
      return true;
    }
    try {
      parseBoolean(q);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid expression");
      return false;
    }
  }

  function handleChange(q: string) {
    setValue(q);
    validate(q);
  }

  function handleSubmit() {
    if (!validate(value)) return;
    onSearch(value);
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="e.g. DSNS OR (DVUP AND DSHS)"
          className={`pr-8 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
          aria-label="GenEd boolean search"
          aria-describedby={error ? "search-error" : undefined}
          spellCheck={false}
        />
        <button
          onClick={handleSubmit}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Search"
          tabIndex={-1}
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p id="search-error" className="text-xs text-destructive px-1">
          {error}
        </p>
      )}
    </div>
  );
}
