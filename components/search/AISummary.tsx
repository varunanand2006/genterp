import type { AISummary } from "@/types/ai-summary";

interface AISummaryProps {
  summary: AISummary | null;
}

export function AISummaryDisplay({ summary }: AISummaryProps) {
  if (!summary) {
    return (
      <p className="text-xs text-muted-foreground italic">No AI summary available yet.</p>
    );
  }

  return (
    <div className="space-y-2 rounded-md bg-primary/5 border border-primary/10 p-3">
      <p className="text-xs font-semibold text-primary">AI Summary ✦</p>
      <p className="text-xs text-foreground leading-relaxed">{summary.vibe}</p>
      {summary.professors && (
        <p className="text-xs text-muted-foreground leading-relaxed">{summary.professors}</p>
      )}
      {summary.pros.length > 0 && (
        <ul className="space-y-0.5">
          {summary.pros.map((pro, i) => (
            <li key={i} className="text-xs text-green-700 dark:text-green-400 flex gap-1.5">
              <span className="shrink-0">+</span>
              {pro}
            </li>
          ))}
        </ul>
      )}
      {summary.cons.length > 0 && (
        <ul className="space-y-0.5">
          {summary.cons.map((con, i) => (
            <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex gap-1.5">
              <span className="shrink-0">−</span>
              {con}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        Based on {summary.review_count} review{summary.review_count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
