"use client";

// =====================================================================
// MentalBatteryGauge
// Radial gauge rendered as an SVG arc — the "instrument panel" reading
// for remaining cognitive load. Color shifts along the same energy
// palette as the timeline so the whole dashboard reads as one system.
// =====================================================================

interface MentalBatteryGaugeProps {
  remainingPercent: number; // 0-100
  max?: number;
}

function levelColor(pct: number): string {
  if (pct >= 65) return "#E8A33D"; // energy-peak
  if (pct >= 35) return "#8A97A3"; // energy-medium
  return "#C15C4A"; // signal-cost — battery critically low
}

export default function MentalBatteryGauge({ remainingPercent }: MentalBatteryGaugeProps) {
  const clamped = Math.min(100, Math.max(0, remainingPercent));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = levelColor(clamped);

  return (
    <div className="flex flex-col items-center rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Mental Battery
      </p>
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#2A343E" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold text-ink-primary">
            {Math.round(clamped)}%
          </span>
          <span className="font-mono text-[10px] text-ink-faint">remaining</span>
        </div>
      </div>
      {clamped < 35 && (
        <p className="mt-3 text-center font-body text-xs text-signal-cost">
          Low charge — consider an NSDR break before more deep work.
        </p>
      )}
    </div>
  );
}
