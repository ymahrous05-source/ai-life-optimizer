"use client";

// =====================================================================
// GoalPremortemCard
// Shows the Monte Carlo pre-mortem result before the user commits to a
// goal's deadline: a probability bar, likely completion date range, and
// a plain-language recommendation grounded in their own history.
// =====================================================================
import type { PremortemResult } from "../../lib/scheduling/goalPremortem";

interface GoalPremortemCardProps {
  result: PremortemResult;
  targetDate: string;
}

const RECOMMENDATION_COLOR: Record<PremortemResult["recommendation"], string> = {
  confident: "#5B9279", // signal-success
  tight: "#E8A33D", // energy-peak
  risky: "#D4914F", // energy-high
  unrealistic: "#C15C4A", // signal-cost
};

export default function GoalPremortemCard({ result, targetDate }: GoalPremortemCardProps) {
  const color = RECOMMENDATION_COLOR[result.recommendation];
  const pct = Math.round(result.probabilityOnTime * 100);

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <p className="mb-2 font-display text-xs uppercase tracking-wider text-ink-muted">
        Pre-mortem — before you commit
      </p>

      <div className="mb-3 flex items-end gap-2">
        <span className="font-mono text-3xl font-semibold" style={{ color }}>
          {pct}%
        </span>
        <span className="mb-1 font-body text-xs text-ink-muted">chance of finishing on time</span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-deck-surfaceRaised">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      <p className="mb-3 font-body text-xs leading-relaxed text-ink-primary">{result.narrative}</p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-mono text-[10px] text-ink-faint">Best case</p>
          <p className="font-mono text-xs text-signal-success">
            {new Date(result.p10CompletionDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-ink-faint">Likely</p>
          <p className="font-mono text-xs text-ink-primary">
            {new Date(result.medianCompletionDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-ink-faint">Worst case</p>
          <p className="font-mono text-xs text-signal-cost">
            {new Date(result.p90CompletionDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
      </div>

      <p className="mt-3 border-t border-deck-line pt-2 font-mono text-[10px] text-ink-faint">
        Deadline: {new Date(targetDate).toLocaleDateString()}
      </p>
    </div>
  );
}
