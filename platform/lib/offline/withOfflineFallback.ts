"use client";

// =====================================================================
// attemptOrQueue()
// The one place that implements the wiring note from the README:
// "Wrap every mutating Supabase call with a try/catch that falls back
// to enqueueOutboxEntry(...) when offline." Used by any client
// component that needs to keep working with no network — the caller
// gets back whether the write went straight through or was queued, so
// it can show the right badge without duplicating this logic.
// =====================================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOutboxEntry, type OutboxEntry } from "./db";

export type MutationOutcome = "synced" | "queued";

interface AttemptOrQueueOptions {
  supabase: SupabaseClient;
  table: OutboxEntry["table"];
  operation: OutboxEntry["operation"];
  payload: Record<string, unknown>;
}

/**
 * Tries the mutation against Supabase directly. If the browser is
 * already known to be offline, skips the network attempt entirely
 * (no point waiting out a timeout) and queues immediately. Any thrown
 * error (network failure, timeout, server error) also queues rather
 * than surfacing a failure to the user — from their point of view the
 * task was "logged"; syncing is our problem, not theirs.
 */
export async function attemptOrQueue({
  supabase,
  table,
  operation,
  payload,
}: AttemptOrQueueOptions): Promise<MutationOutcome> {
  const knownOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (!knownOffline) {
    try {
      const query = supabase.from(table);
      const { id, ...rest } = payload as { id: string; [k: string]: unknown };
      const { error } =
        operation === "insert"
          ? await query.insert(payload)
          : operation === "update"
          ? await query.update(rest).eq("id", id)
          : await query.delete().eq("id", id);

      if (!error) return "synced";
    } catch {
      // network/transport failure — fall through to queueing below
    }
  }

  await enqueueOutboxEntry({ table, operation, payload });
  return "queued";
}
