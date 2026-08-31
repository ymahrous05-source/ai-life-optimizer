"use client";

// =====================================================================
// VoiceCapture
// Microphone button + live transcript readout. On finalized speech,
// hands the transcript to a server action that parses it (Gemini) and
// inserts a new task, then reports success back into the UI.
// =====================================================================
import { useVoiceToTask } from "../../lib/voice/useVoiceToTask";

interface VoiceCaptureProps {
  onTranscriptReady: (transcript: string) => Promise<void>;
  lastCreatedTaskTitle?: string | null;
}

export default function VoiceCapture({
  onTranscriptReady,
  lastCreatedTaskTitle,
}: VoiceCaptureProps) {
  const { status, liveTranscript, errorMessage, startListening, stopListening } =
    useVoiceToTask({ onTranscriptReady });

  if (status === "unsupported") {
    return (
      <p className="rounded-deck border border-deck-line bg-deck-surface p-3 font-body text-xs text-ink-muted">
        Voice capture isn&apos;t supported in this browser. Try Chrome or Edge.
      </p>
    );
  }

  const isListening = status === "listening";

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <div className="flex items-center gap-3">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={status === "processing"}
          aria-pressed={isListening}
          aria-label={isListening ? "Stop voice capture" : "Start voice capture"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition ${
            isListening
              ? "border-signal-cost bg-signal-cost/20 animate-pulse"
              : "border-energy-peak bg-energy-peak/10 hover:bg-energy-peak/20"
          }`}
        >
          🎙️
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {status === "processing"
              ? "Parsing into a task…"
              : isListening
              ? "Listening…"
              : "Voice-to-Task"}
          </p>
          <p className="truncate font-body text-sm text-ink-primary">
            {liveTranscript || lastCreatedTaskTitle || "Tap the mic and speak a task"}
          </p>
        </div>
      </div>
      {status === "error" && errorMessage && (
        <p className="mt-2 font-body text-xs text-signal-cost">Error: {errorMessage}</p>
      )}
    </div>
  );
}
