"use client";

// =====================================================================
// QuickTaskCapture
// One-line "log a task right now" input that never blocks on network.
// Every task is written to IndexedDB immediately (so it shows up right
// away, even mid-flight on the subway), then either synced to Supabase
// straight away or queued in the offline outbox for the sync engine to
// flush automatically once connectivity returns.
// =====================================================================
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertCachedTask } from "../../lib/offline/db";
import { attemptOrQueue, type MutationOutcome } from "../../lib/offline/withOfflineFallback";
import type { Task } from "../../lib/types";

interface QuickTaskCaptureProps {
  supabase: SupabaseClient;
  userId: string;
}

interface LoggedTask {
  id: string;
  title: string;
  outcome: MutationOutcome;
}

export default function QuickTaskCapture({ supabase, userId }: QuickTaskCaptureProps) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recentlyLogged, setRecentlyLogged] = useState<LoggedTask[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    const id = crypto.randomUUID();

    const payload = {
      id,
      user_id: userId,
      title: trimmed,
      status: "backlog",
    };

    // Optimistic local write first — the task is "logged" the instant
    // this resolves, regardless of what the network is doing.
    await upsertCachedTask({
      id,
      userId,
      title: trimmed,
      status: "backlog",
    } as Task);

    const outcome = await attemptOrQueue({
      supabase,
      table: "tasks",
      operation: "insert",
      payload,
    });

    setRecentlyLogged((prev) => [{ id, title: trimmed, outcome }, ...prev].slice(0, 4));
    setTitle("");
    setSubmitting(false);
  }

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Quick Log
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Log a task — works offline too"
          className="min-w-0 flex-1 rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-body text-sm text-ink-primary placeholder:text-ink-faint focus:border-energy-peak/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="shrink-0 rounded-deck border border-deck-line bg-deck-surfaceRaised px-4 py-2 font-body text-xs font-medium text-ink-primary transition hover:border-energy-peak/60 disabled:opacity-50"
        >
          Log
        </button>
      </form>

      {recentlyLogged.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {recentlyLogged.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2">
              <span className="truncate font-body text-xs text-ink-muted">{t.title}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                  t.outcome === "synced"
                    ? "bg-signal-success/15 text-signal-success"
                    : "bg-signal-info/15 text-signal-info"
                }`}
              >
                {t.outcome === "synced" ? "Synced" : "Queued"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
