"use client";

// =====================================================================
// FocusLockdownOverlay
// Full-screen, minimalist distraction-free mode for deep work. Shows
// only the active task, a countdown, and an exit affordance — nothing
// else competes for attention.
// =====================================================================
import { useEffect, useState } from "react";

interface FocusLockdownOverlayProps {
  taskTitle: string;
  plannedMinutes: number;
  onExit: (wasInterrupted: boolean) => void;
}

export default function FocusLockdownOverlay({
  taskTitle,
  plannedMinutes,
  onExit,
}: FocusLockdownOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(plannedMinutes * 60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isComplete = secondsLeft === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-deck-bg">
      <p className="mb-4 font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
        Focus Lockdown
      </p>
      <h1 className="mb-8 max-w-xl text-center font-display text-2xl font-semibold text-ink-primary">
        {taskTitle}
      </h1>
      <div className="mb-10 font-mono text-6xl font-light tabular-nums text-energy-peak">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>

      {isComplete ? (
        <p className="mb-6 font-body text-sm text-signal-success">Session complete.</p>
      ) : null}

      <button
        onClick={() => onExit(!isComplete)}
        className="rounded-deck border border-deck-line px-6 py-2 font-body text-xs text-ink-muted transition hover:border-signal-cost/60 hover:text-signal-cost"
      >
        {isComplete ? "Close" : "End session early"}
      </button>
    </div>
  );
}
