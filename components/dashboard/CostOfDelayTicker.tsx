"use client";

// =====================================================================
// CostOfDelayTicker
// Converts wasted/delayed hours into a live monetary figure using the
// user's hourly rate — the Financial Opportunity Cost Tracker surfaced
// as a single, hard-to-ignore instrument reading.
// =====================================================================
import { useEffect, useState } from "react";

interface CostOfDelayTickerProps {
  hourlyRate: number;
  delayedMinutesToday: number; // accumulated so far today
  isAccumulatingLive?: boolean; // true while an active delay is in progress
}

export default function CostOfDelayTicker({
  hourlyRate,
  delayedMinutesToday,
  isAccumulatingLive = false,
}: CostOfDelayTickerProps) {
  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    if (!isAccumulatingLive) {
      setLiveSeconds(0);
      return;
    }
    const interval = setInterval(() => setLiveSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isAccumulatingLive]);

  const totalMinutes = delayedMinutesToday + liveSeconds / 60;
  const costDollars = (totalMinutes / 60) * hourlyRate;

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <p className="font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Cost of Delay — Today
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold text-signal-cost">
        ${costDollars.toFixed(2)}
      </p>
      <p className="mt-1 font-mono text-[11px] text-ink-faint">
        {Math.round(totalMinutes)} min delayed · ${hourlyRate.toFixed(0)}/hr rate
        {isAccumulatingLive && (
          <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-signal-cost align-middle" />
        )}
      </p>
    </div>
  );
}
