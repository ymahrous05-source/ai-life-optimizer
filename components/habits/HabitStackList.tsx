"use client";

// =====================================================================
// HabitStackList
// Shows all active micro-habits, each with its current/longest streak
// and which routine task it's stacked onto ("After X, do Y"). Includes
// a manual log button for habits not tied to an automatic trigger.
// =====================================================================
interface HabitListItem {
  id: string;
  title: string;
  triggerTaskTitle: string | null;
  durationMinutes: number;
  currentStreak: number;
  longestStreak: number;
  loggedToday: boolean;
}

interface HabitStackListProps {
  habits: HabitListItem[];
  onLogHabit: (habitId: string) => Promise<void>;
}

export default function HabitStackList({ habits, onLogHabit }: HabitStackListProps) {
  if (habits.length === 0) {
    return (
      <div className="rounded-deck border border-deck-line bg-deck-surface p-4 text-center shadow-panel">
        <p className="font-body text-xs text-ink-muted">
          No habits yet — stack one onto a routine task to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <p className="mb-3 font-display text-xs uppercase tracking-wider text-ink-muted">
        Habit Stack
      </p>
      <ul className="space-y-2">
        {habits.map((h) => (
          <li
            key={h.id}
            className="flex items-center justify-between gap-3 rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm text-ink-primary">{h.title}</p>
              <p className="truncate font-body text-[10px] text-ink-faint">
                {h.triggerTaskTitle ? `After: ${h.triggerTaskTitle}` : `${h.durationMinutes} min`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <p className="font-mono text-sm text-energy-peak">🔥 {h.currentStreak}</p>
                <p className="font-mono text-[9px] text-ink-faint">best {h.longestStreak}</p>
              </div>
              <button
                onClick={() => onLogHabit(h.id)}
                disabled={h.loggedToday}
                className={`rounded-full border px-2.5 py-1 font-body text-[11px] transition ${
                  h.loggedToday
                    ? "border-signal-success/40 bg-signal-success/10 text-signal-success"
                    : "border-deck-line text-ink-muted hover:border-energy-peak/60"
                }`}
              >
                {h.loggedToday ? "Done ✓" : "Log"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
