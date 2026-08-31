"use client";

// =====================================================================
// LifeScoreOrb
// A single pulsing 0-100 orb replacing the need to mentally combine
// four separate gauges. Color and pulse speed communicate the band;
// a one-line explanation says what's driving it right now.
// =====================================================================
import type { LifeScoreResult } from "../../lib/life/computeLifeScore";

interface LifeScoreOrbProps {
  result: LifeScoreResult;
}

const BAND_COLOR: Record<LifeScoreResult["band"], string> = {
  thriving: "#E8A33D", // energy-peak
  steady: "#8A97A3", // energy-medium
  strained: "#4A6C82", // energy-low
  critical: "#C15C4A", // signal-cost
};

const TREND_ICON: Record<LifeScoreResult["trend"], string> = {
  rising: "↗",
  steady: "→",
  falling: "↘",
};

export default function LifeScoreOrb({ result }: LifeScoreOrbProps) {
  const color = BAND_COLOR[result.band];
  const pulseDuration = result.band === "critical" ? "1.2s" : result.band === "strained" ? "2s" : "3.2s";

  return (
    <div className="flex flex-col items-center rounded-deck border border-deck-line bg-deck-surface p-5 shadow-panel">
      <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Life Score
      </p>

      <div className="relative flex h-28 w-28 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full opacity-20"
          style={{ backgroundColor: color, animation: `dashboard-pulse ${pulseDuration} ease-in-out infinite` }}
        />
        <div
          className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-2"
          style={{ borderColor: color }}
        >
          <span className="font-mono text-3xl font-semibold" style={{ color }}>
            {result.score}
          </span>
          <span className="font-mono text-[10px] text-ink-faint">
            {TREND_ICON[result.trend]} {result.band}
          </span>
        </div>
      </div>

      <p className="mt-3 text-center font-body text-xs text-ink-muted">{result.dominantFactor}</p>

      <style>{`
        @keyframes dashboard-pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.15); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
