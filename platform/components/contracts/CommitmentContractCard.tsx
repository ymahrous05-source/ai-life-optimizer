"use client";

// =====================================================================
// CommitmentContractCard
// Shows a single commitment contract: the stake, accountability
// partner, and countdown to due date. Includes the "Phantom Penalty"
// visualization — a bar showing lifetime hours lost to procrastination,
// leaning on loss aversion rather than positive framing.
// =====================================================================
interface CommitmentContractCardProps {
  taskTitle: string;
  stakeDescription: string;
  partnerName: string | null;
  dueAt: string; // ISO
  isFulfilled: boolean | null; // null = not yet due
  lifetimeHoursLost: number; // for the Phantom Penalty avatar/bar
  onMarkFulfilled: () => Promise<void>;
}

export default function CommitmentContractCard({
  taskTitle,
  stakeDescription,
  partnerName,
  dueAt,
  isFulfilled,
  lifetimeHoursLost,
  onMarkFulfilled,
}: CommitmentContractCardProps) {
  const dueDate = new Date(dueAt);
  const isPastDue = dueDate.getTime() < Date.now() && isFulfilled === null;
  const hoursRemaining = Math.max(0, (dueDate.getTime() - Date.now()) / 3.6e6);

  const barWidth = Math.min(100, (lifetimeHoursLost / 100) * 100); // caps visual at 100h

  return (
    <div
      className={`rounded-deck border p-4 shadow-panel ${
        isPastDue ? "border-signal-cost bg-signal-cost/5" : "border-deck-line bg-deck-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-body text-sm font-medium text-ink-primary">{taskTitle}</p>
          <p className="mt-0.5 font-body text-xs text-ink-muted">Stake: {stakeDescription}</p>
          {partnerName && (
            <p className="font-body text-xs text-ink-faint">Accountability: {partnerName}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
            isFulfilled
              ? "bg-signal-success/15 text-signal-success"
              : isPastDue
              ? "bg-signal-cost/15 text-signal-cost"
              : "bg-deck-surfaceRaised text-ink-muted"
          }`}
        >
          {isFulfilled ? "Fulfilled" : isPastDue ? "Missed" : `${Math.round(hoursRemaining)}h left`}
        </span>
      </div>

      <div className="mt-3">
        <p className="mb-1 font-mono text-[10px] text-ink-faint">
          Lifetime hours lost to procrastination: {lifetimeHoursLost.toFixed(1)}h
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-deck-surfaceRaised">
          <div
            className="h-full rounded-full bg-signal-cost transition-all"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {isFulfilled === null && !isPastDue && (
        <button
          onClick={onMarkFulfilled}
          className="mt-3 w-full rounded-deck border border-deck-line px-3 py-1.5 font-body text-xs text-ink-primary transition hover:border-signal-success/60"
        >
          Mark as done
        </button>
      )}
    </div>
  );
}
