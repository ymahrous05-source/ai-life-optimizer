"use client";

// =====================================================================
// ReflectionCoach
// End-of-day retrospective card: shows the AI-generated summary and
// follow-up questions, and lets the user jot free-text answers that
// get saved to the `reflections` table via a passed-in Server Action.
// =====================================================================
import { useState } from "react";
import type { DailyReflectionOutput } from "../../lib/ai/generateDailyReflectionSummary";

interface ReflectionCoachProps {
  reflection: DailyReflectionOutput;
  mood?: "great" | "good" | "neutral" | "low" | "burnt_out";
  onSaveAnswer: (answers: { question: string; answer: string }[], mood: string) => Promise<void>;
}

const MOODS: Array<{ value: ReflectionCoachProps["mood"]; label: string; emoji: string }> = [
  { value: "great", label: "Great", emoji: "🌟" },
  { value: "good", label: "Good", emoji: "🙂" },
  { value: "neutral", label: "Neutral", emoji: "😐" },
  { value: "low", label: "Low", emoji: "😞" },
  { value: "burnt_out", label: "Burnt out", emoji: "🥱" },
];

export default function ReflectionCoach({ reflection, onSaveAnswer }: ReflectionCoachProps) {
  const [answers, setAnswers] = useState<string[]>(
    reflection.followUpQuestions.map(() => "")
  );
  const [selectedMood, setSelectedMood] = useState<string>("neutral");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveAnswer(
        reflection.followUpQuestions.map((q, i) => ({ question: q, answer: answers[i] })),
        selectedMood
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-5 shadow-panel">
      <p className="font-display text-xs uppercase tracking-wider text-ink-muted">
        Daily Reflection Coach
      </p>
      <p className="mt-2 font-body text-sm leading-relaxed text-ink-primary">
        {reflection.summary}
      </p>

      <div className="my-4 flex gap-2">
        {MOODS.map((m) => (
          <button
            key={m.value}
            onClick={() => setSelectedMood(m.value!)}
            className={`rounded-deck border px-3 py-1.5 font-body text-xs transition ${
              selectedMood === m.value
                ? "border-energy-peak bg-energy-peak/10 text-ink-primary"
                : "border-deck-line text-ink-muted hover:border-deck-line/80"
            }`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {reflection.followUpQuestions.map((q, i) => (
          <div key={i}>
            <label className="mb-1 block font-body text-xs text-ink-muted">{q}</label>
            <textarea
              value={answers[i]}
              onChange={(e) =>
                setAnswers((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))
              }
              rows={2}
              className="w-full resize-none rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-body text-sm text-ink-primary outline-none focus:border-energy-peak"
            />
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-body text-xs text-ink-muted">
        Tomorrow: {reflection.suggestedFocusForTomorrow}
      </p>

      <button
        onClick={handleSave}
        disabled={saving || saved}
        className="mt-4 w-full rounded-deck bg-energy-peak px-4 py-2 font-body text-sm font-medium text-deck-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {saved ? "Saved ✓" : saving ? "Saving…" : "Save reflection"}
      </button>
    </div>
  );
}
