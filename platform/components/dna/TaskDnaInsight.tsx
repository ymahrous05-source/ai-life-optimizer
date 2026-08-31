"use client";

// =====================================================================
// TaskDnaInsight
// Shows a live, personalized estimate as the user types a task/goal
// title — grounded in their own historical completion data via
// pgvector similarity search, not a generic category average.
// =====================================================================
import { useEffect, useRef, useState } from "react";
import type { TaskDnaInsight as TaskDnaInsightData } from "../../lib/dna/taskDna";

interface TaskDnaInsightProps {
  draftTitle: string;
  draftDescription?: string;
  onFetchInsight: (title: string, description?: string) => Promise<TaskDnaInsightData>;
  onAcceptSuggestion?: (minutes: number) => void;
}

const DEBOUNCE_MS = 700;

export default function TaskDnaInsight({
  draftTitle,
  draftDescription,
  onFetchInsight,
  onAcceptSuggestion,
}: TaskDnaInsightProps) {
  const [insight, setInsight] = useState<TaskDnaInsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (draftTitle.trim().length < 6) {
      setInsight(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await onFetchInsight(draftTitle, draftDescription);
        setInsight(result);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTitle, draftDescription]);

  if (draftTitle.trim().length < 6) return null;

  return (
    <div className="rounded-deck border border-deck-line bg-energy-peak/5 p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-energy-peak" />
        <p className="font-display text-[10px] uppercase tracking-wider text-energy-peak">
          Task DNA
        </p>
      </div>

      {loading && !insight ? (
        <p className="font-body text-xs text-ink-faint">Checking your history…</p>
      ) : insight ? (
        <>
          <p className="font-body text-xs leading-relaxed text-ink-primary">
            {insight.narrative}
          </p>
          {insight.hasEnoughData && insight.suggestedMinutes && (
            <button
              type="button"
              onClick={() => onAcceptSuggestion?.(insight.suggestedMinutes!)}
              className="mt-2 rounded-full border border-energy-peak/40 bg-energy-peak/10 px-2.5 py-1 font-mono text-[11px] text-energy-peak transition hover:bg-energy-peak/20"
            >
              Use {insight.suggestedMinutes}m instead
            </button>
          )}
          {insight.topMatches.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {insight.topMatches.map((m, i) => (
                <li key={i} className="font-mono text-[10px] text-ink-faint">
                  · {m.title} ({Math.round(m.similarity * 100)}% match)
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
