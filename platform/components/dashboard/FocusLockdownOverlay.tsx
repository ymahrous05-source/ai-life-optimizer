"use client";

// =====================================================================
// FocusLockdownOverlay
// Full-screen, minimalist Pomodoro lockdown for deep work. Pressing
// "Focus Lockdown" always starts a fixed 25-minute session (the
// standard Pomodoro length — deliberately decoupled from a task's own
// estimate, since the point is a consistent, trustworthy rhythm) with:
//   - distraction blocking: requests real browser Fullscreen, warns
//     (without penalizing) if the tab loses focus mid-session, and
//     confirms before an accidental close/refresh.
//   - a calm, synthesized nature soundscape (see useAmbientNatureSound)
//     to concentrate to — on by default, toggleable, no audio file.
//   - the session is persisted to focus_sessions the instant it starts
//     and updated on exit, going through the same offline-safe
//     attemptOrQueue() path as everything else — a lockdown session
//     started on the subway with no signal still gets logged.
// =====================================================================
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAmbientNatureSound } from "../../lib/audio/useAmbientNatureSound";
import { attemptOrQueue } from "../../lib/offline/withOfflineFallback";

const POMODORO_MINUTES = 25;

interface FocusLockdownOverlayProps {
  taskTitle: string;
  taskId?: string;
  supabase: SupabaseClient;
  userId: string;
  onExit: (wasInterrupted: boolean) => void;
}

export default function FocusLockdownOverlay({
  taskTitle,
  taskId,
  supabase,
  userId,
  onExit,
}: FocusLockdownOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(POMODORO_MINUTES * 60);
  const [distractionCount, setDistractionCount] = useState(0);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const startedRef = useRef(false);
  const { isPlaying, toggle: toggleSound } = useAmbientNatureSound();

  const isComplete = secondsLeft === 0;

  // ---- Persist session start, once ------------------------------------
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void attemptOrQueue({
      supabase,
      table: "focus_sessions",
      operation: "insert",
      payload: {
        id: sessionIdRef.current,
        user_id: userId,
        task_id: taskId ?? null,
        session_type: "lockdown",
        planned_minutes: POMODORO_MINUTES,
      },
    });

    // Start the calm nature soundscape by default.
    toggleSound();

    // Distraction blocking: go fullscreen where the browser allows it.
    document.documentElement.requestFullscreen?.().catch(() => {
      // Some browsers/contexts (e.g. iframes without permission) reject
      // this silently — the overlay itself still blocks the rest of the
      // UI, so it degrades gracefully.
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Countdown --------------------------------------------------------
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // ---- Distraction detection: flag tab-switches without ending the session
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !isComplete) {
        setDistractionCount((c) => c + 1);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isComplete]);

  // ---- Warn before an accidental close/refresh mid-session --------------
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isComplete) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isComplete]);

  async function handleExit(wasInterrupted: boolean) {
    if (isPlaying) toggleSound();
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }

    await attemptOrQueue({
      supabase,
      table: "focus_sessions",
      operation: "update",
      payload: {
        id: sessionIdRef.current,
        ended_at: new Date().toISOString(),
        was_interrupted: wasInterrupted,
      },
    });

    onExit(wasInterrupted);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-deck-bg">
      <p className="mb-4 font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
        Focus Lockdown · {POMODORO_MINUTES} min
      </p>
      <h1 className="mb-8 max-w-xl text-center font-display text-2xl font-semibold text-ink-primary">
        {taskTitle}
      </h1>
      <div className="mb-6 font-mono text-6xl font-light tabular-nums text-energy-peak">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>

      <button
        onClick={toggleSound}
        aria-pressed={isPlaying}
        title="أصوات طبيعية هادئة للتركيز"
        className={`mb-8 flex items-center gap-2 rounded-full border px-4 py-1.5 font-body text-xs transition ${
          isPlaying
            ? "border-signal-info/60 bg-signal-info/10 text-signal-info"
            : "border-deck-line text-ink-faint hover:border-signal-info/40"
        }`}
      >
        {isPlaying ? "🌧️ Nature sounds on" : "🌧️ Nature sounds off"}
      </button>

      {distractionCount > 0 && !isComplete && (
        <p className="mb-4 font-body text-xs text-signal-cost">
          {distractionCount} distraction{distractionCount > 1 ? "s" : ""} detected this session —
          you&apos;ve got this.
        </p>
      )}

      {isComplete ? (
        <p className="mb-6 font-body text-sm text-signal-success">Session complete.</p>
      ) : null}

      <button
        onClick={() => handleExit(!isComplete)}
        className="rounded-deck border border-deck-line px-6 py-2 font-body text-xs text-ink-muted transition hover:border-signal-cost/60 hover:text-signal-cost"
      >
        {isComplete ? "Close" : "End session early"}
      </button>
    </div>
  );
}
