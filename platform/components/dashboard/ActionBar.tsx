"use client";

// =====================================================================
// ActionBar
// One-click controls that trigger the AI engine (Smart Reschedule),
// a bio-recovery session (NSDR), or a distraction-free UI mode
// (Focus Lockdown). Each button carries a loading state since all
// three trigger server-side work.
// =====================================================================
import { useState } from "react";

interface ActionBarProps {
  onSmartReschedule: () => Promise<void>;
  onStartNsdr: () => Promise<void>;
  onEnterLockdown: () => void;
  burnoutRiskScore?: number; // 0-100, used to visually flag NSDR when risk is high
}

type ActionKey = "reschedule" | "nsdr" | "lockdown";

export default function ActionBar({
  onSmartReschedule,
  onStartNsdr,
  onEnterLockdown,
  burnoutRiskScore = 0,
}: ActionBarProps) {
  const [loading, setLoading] = useState<ActionKey | null>(null);

  async function handle(key: ActionKey, fn: () => Promise<void> | void) {
    setLoading(key);
    try {
      await fn();
    } finally {
      setLoading(null);
    }
  }

  const nsdrUrgent = burnoutRiskScore >= 50;

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => handle("reschedule", onSmartReschedule)}
        disabled={loading !== null}
        className="flex-1 min-w-[160px] rounded-deck border border-deck-line bg-deck-surfaceRaised px-4 py-3 font-body text-sm font-medium text-ink-primary shadow-panel transition hover:border-energy-peak/60 disabled:opacity-50"
      >
        {loading === "reschedule" ? "Rescheduling…" : "⚡ Smart Reschedule"}
      </button>

      <button
        onClick={() => handle("nsdr", onStartNsdr)}
        disabled={loading !== null}
        className={`flex-1 min-w-[160px] rounded-deck border px-4 py-3 font-body text-sm font-medium shadow-panel transition disabled:opacity-50 ${
          nsdrUrgent
            ? "border-signal-cost bg-signal-cost/10 text-ink-primary animate-pulse"
            : "border-deck-line bg-deck-surfaceRaised text-ink-primary hover:border-energy-trough/60"
        }`}
      >
        {loading === "nsdr" ? "Starting…" : "🌙 NSDR Break"}
      </button>

      <button
        onClick={() => handle("lockdown", async () => onEnterLockdown())}
        disabled={loading !== null}
        className="flex-1 min-w-[160px] rounded-deck border border-deck-line bg-deck-surfaceRaised px-4 py-3 font-body text-sm font-medium text-ink-primary shadow-panel transition hover:border-signal-info/60 disabled:opacity-50"
      >
        🔒 Focus Lockdown
      </button>
    </div>
  );
}
