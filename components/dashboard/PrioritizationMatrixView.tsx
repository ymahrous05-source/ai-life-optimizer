"use client";

// =====================================================================
// PrioritizationMatrixView
// Multi-Framework Prioritization (Section A): renders the classic
// 2x2 Eisenhower Matrix as the primary spatial layout, with each task
// card also showing its ABCDE letter, MoSCoW tag, and 1-3-5 badge —
// so all four frameworks are visible on the same board without forcing
// the user to pick just one methodology.
// =====================================================================
import type {
  AbcdePriority,
  EisenhowerQuadrant,
  MoscowPriority,
} from "../../lib/types";

export interface PrioritizedTaskCard {
  id: string;
  title: string;
  eisenhowerQuadrant: EisenhowerQuadrant;
  abcde: AbcdePriority | null;
  moscow: MoscowPriority | null;
  isIn1_3_5: boolean;
  one3_5Size: "big" | "medium" | "small" | null;
  dynamicPriorityScore: number;
}

interface PrioritizationMatrixViewProps {
  tasks: PrioritizedTaskCard[];
  onSelectTask?: (taskId: string) => void;
}

const QUADRANTS: Array<{
  key: EisenhowerQuadrant;
  label: string;
  sublabel: string;
  accent: string;
}> = [
  { key: "urgent_important", label: "Do", sublabel: "Urgent & Important", accent: "border-signal-cost" },
  { key: "not_urgent_important", label: "Schedule", sublabel: "Important, Not Urgent", accent: "border-energy-peak" },
  { key: "urgent_not_important", label: "Delegate", sublabel: "Urgent, Not Important", accent: "border-signal-info" },
  { key: "not_urgent_not_important", label: "Eliminate", sublabel: "Neither", accent: "border-deck-line" },
];

const MOSCOW_LABEL: Record<MoscowPriority, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

function TaskCard({ task, onSelect }: { task: PrioritizedTaskCard; onSelect?: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full rounded-deck border border-deck-line bg-deck-surfaceRaised p-2.5 text-left shadow-panel transition hover:border-energy-peak/50"
    >
      <p className="truncate font-body text-xs font-medium text-ink-primary">{task.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {task.abcde && (
          <span className="rounded-full bg-deck-surface px-1.5 py-0.5 font-mono text-[9px] text-ink-muted">
            {task.abcde}
          </span>
        )}
        {task.moscow && (
          <span className="rounded-full bg-deck-surface px-1.5 py-0.5 font-mono text-[9px] text-ink-muted">
            {MOSCOW_LABEL[task.moscow]}
          </span>
        )}
        {task.isIn1_3_5 && (
          <span className="rounded-full bg-energy-peak/15 px-1.5 py-0.5 font-mono text-[9px] text-energy-peak">
            1-3-5 · {task.one3_5Size}
          </span>
        )}
        <span className="ml-auto font-mono text-[9px] text-ink-faint">
          {task.dynamicPriorityScore.toFixed(1)}
        </span>
      </div>
    </button>
  );
}

export default function PrioritizationMatrixView({
  tasks,
  onSelectTask,
}: PrioritizationMatrixViewProps) {
  const grouped = QUADRANTS.map((q) => ({
    ...q,
    tasks: tasks
      .filter((t) => t.eisenhowerQuadrant === q.key)
      .sort((a, b) => b.dynamicPriorityScore - a.dynamicPriorityScore),
  }));

  const oneThreeFive = {
    big: tasks.filter((t) => t.isIn1_3_5 && t.one3_5Size === "big"),
    medium: tasks.filter((t) => t.isIn1_3_5 && t.one3_5Size === "medium"),
    small: tasks.filter((t) => t.isIn1_3_5 && t.one3_5Size === "small"),
  };

  return (
    <div className="space-y-6">
      <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
        <p className="mb-3 font-display text-xs uppercase tracking-wider text-ink-muted">
          Eisenhower Matrix
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {grouped.map((q) => (
            <div key={q.key} className={`rounded-deck border-t-2 ${q.accent} bg-deck-surfaceRaised/40 p-3`}>
              <div className="mb-2">
                <p className="font-display text-sm font-semibold text-ink-primary">{q.label}</p>
                <p className="font-body text-[10px] text-ink-faint">{q.sublabel}</p>
              </div>
              <div className="space-y-1.5">
                {q.tasks.length === 0 ? (
                  <p className="py-2 text-center font-body text-[11px] text-ink-faint">Empty</p>
                ) : (
                  q.tasks.map((t) => (
                    <TaskCard key={t.id} task={t} onSelect={() => onSelectTask?.(t.id)} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
        <p className="mb-3 font-display text-xs uppercase tracking-wider text-ink-muted">
          Today&apos;s 1-3-5 Rule
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-mono text-lg text-ink-primary">{oneThreeFive.big.length}/1</p>
            <p className="font-body text-[10px] text-ink-faint">Big thing</p>
          </div>
          <div>
            <p className="font-mono text-lg text-ink-primary">{oneThreeFive.medium.length}/3</p>
            <p className="font-body text-[10px] text-ink-faint">Medium things</p>
          </div>
          <div>
            <p className="font-mono text-lg text-ink-primary">{oneThreeFive.small.length}/5</p>
            <p className="font-body text-[10px] text-ink-faint">Small things</p>
          </div>
        </div>
      </div>
    </div>
  );
}
