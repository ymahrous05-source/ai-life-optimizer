"use client";

// =====================================================================
// ReverseTimelineView
// Renders a goal's backward-scheduled plan: deadline at the top,
// working back to "today" at the bottom, so the user sees exactly how
// much runway remains and whether the plan is feasible.
// =====================================================================
import type { ReverseTimeBlockResult } from "../../lib/scheduling/reverseTimeBlock";

interface ReverseTimelineViewProps {
  goalTitle: string;
  targetDate: string; // ISO date
  result: ReverseTimeBlockResult;
}

export default function ReverseTimelineView({
  goalTitle,
  targetDate,
  result,
}: ReverseTimelineViewProps) {
  const { placements, feasible, daysNeeded, overflowMinutes } = result;

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-wider text-ink-muted">
            Reverse Time Block
          </p>
          <h3 className="font-display text-sm font-semibold text-ink-primary">{goalTitle}</h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-ink-faint">
            Due {new Date(targetDate).toLocaleDateString()}
          </p>
          <p className="font-mono text-xs text-ink-faint">{daysNeeded} working days needed</p>
        </div>
      </div>

      {!feasible && (
        <div className="mb-4 rounded-deck border border-signal-cost/40 bg-signal-cost/10 px-3 py-2">
          <p className="font-body text-xs text-signal-cost">
            This plan needs to start {Math.round(overflowMinutes / 60)}h earlier than today — the
            deadline may not be achievable at the current daily capacity. Consider increasing
            daily hours or moving the target date.
          </p>
        </div>
      )}

      <ol className="relative border-l border-deck-line pl-4">
        {placements.map((p, i) => (
          <li key={p.id} className="mb-4 last:mb-0">
            <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-energy-peak" />
            <p className="font-mono text-[10px] text-ink-faint">
              {new Date(p.scheduledStart).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="font-body text-sm text-ink-primary">{p.title}</p>
          </li>
        ))}
        <li>
          <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-signal-cost" />
          <p className="font-body text-xs text-signal-cost">Deadline</p>
        </li>
      </ol>
    </div>
  );
}
