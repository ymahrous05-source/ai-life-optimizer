"use client";

// =====================================================================
// EnergyCheckIn
// One-tap self-report of current energy level + cognitive load, feeding
// the energy_logs table that both the Mental Battery gauge and the
// Burnout predictor read from. Meant to be nudged every couple hours.
// =====================================================================
import { useState } from "react";
import type { EnergyLevel } from "../../lib/types";

interface EnergyCheckInProps {
  onLogEnergy: (level: EnergyLevel, cognitiveLoadRemaining: number) => Promise<void>;
}

const LEVELS: Array<{ value: EnergyLevel; label: string; emoji: string }> = [
  { value: "peak", label: "Peak", emoji: "🔋" },
  { value: "high", label: "High", emoji: "⚡" },
  { value: "medium", label: "Medium", emoji: "🙂" },
  { value: "low", label: "Low", emoji: "🪫" },
  { value: "trough", label: "Trough", emoji: "😴" },
];

const LOAD_BY_LEVEL: Record<EnergyLevel, number> = {
  peak: 90,
  high: 70,
  medium: 50,
  low: 25,
  trough: 10,
};

export default function EnergyCheckIn({ onLogEnergy }: EnergyCheckInProps) {
  const [selected, setSelected] = useState<EnergyLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  async function handleSelect(level: EnergyLevel) {
    setSelected(level);
    setSaving(true);
    try {
      await onLogEnergy(level, LOAD_BY_LEVEL[level]);
      setJustLogged(true);
      setTimeout(() => setJustLogged(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <p className="mb-3 font-display text-xs uppercase tracking-wider text-ink-muted">
        How&apos;s your energy right now?
      </p>
      <div className="flex justify-between gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            onClick={() => handleSelect(l.value)}
            disabled={saving}
            className={`flex flex-1 flex-col items-center gap-1 rounded-deck border px-1 py-2 transition disabled:opacity-50 ${
              selected === l.value
                ? "border-energy-peak bg-energy-peak/10"
                : "border-deck-line hover:border-deck-line/70"
            }`}
          >
            <span className="text-lg">{l.emoji}</span>
            <span className="font-body text-[10px] text-ink-muted">{l.label}</span>
          </button>
        ))}
      </div>
      {justLogged && (
        <p className="mt-2 text-center font-body text-[11px] text-signal-success">Logged ✓</p>
      )}
    </div>
  );
}
