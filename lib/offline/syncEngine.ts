"use client";

// =====================================================================
// syncEngine
// Flushes the IndexedDB outbox to Supabase whenever the browser comes
// back online (or on a periodic timer as a safety net). Uses a simple
// retry-with-backoff and gives up after MAX_ATTEMPTS, surfacing the
// entry via onSyncError for manual resolution rather than looping forever.
// =====================================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOutboxEntries,
  removeOutboxEntry,
  incrementOutboxAttempts,
  type OutboxEntry,
} from "./db";

const MAX_ATTEMPTS = 5;

export interface SyncEngineOptions {
  supabase: SupabaseClient;
  onSyncStart?: () => void;
  onSyncComplete?: (synced: number, failed: number) => void;
  onEntryError?: (entry: OutboxEntry, error: unknown) => void;
}

let isSyncing = false;

export async function flushOutbox({
  supabase,
  onSyncStart,
  onSyncComplete,
  onEntryError,
}: SyncEngineOptions): Promise<void> {
  if (isSyncing) return; // avoid overlapping sync runs
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  isSyncing = true;
  onSyncStart?.();

  let synced = 0;
  let failed = 0;

  try {
    const entries = await getOutboxEntries();

    for (const entry of entries) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        failed++;
        onEntryError?.(entry, new Error("Max sync attempts exceeded"));
        continue;
      }

      try {
        await applyOutboxEntry(supabase, entry);
        await removeOutboxEntry(entry.id);
        synced++;
      } catch (err) {
        await incrementOutboxAttempts(entry.id);
        failed++;
        onEntryError?.(entry, err);
      }
    }
  } finally {
    isSyncing = false;
    onSyncComplete?.(synced, failed);
  }
}

async function applyOutboxEntry(
  supabase: SupabaseClient,
  entry: OutboxEntry
): Promise<void> {
  const table = supabase.from(entry.table);

  switch (entry.operation) {
    case "insert":
      const { error: insertError } = await table.insert(entry.payload);
      if (insertError) throw insertError;
      break;
    case "update": {
      const { id, ...rest } = entry.payload as { id: string; [k: string]: unknown };
      const { error: updateError } = await table.update(rest).eq("id", id);
      if (updateError) throw updateError;
      break;
    }
    case "delete": {
      const { id } = entry.payload as { id: string };
      const { error: deleteError } = await table.delete().eq("id", id);
      if (deleteError) throw deleteError;
      break;
    }
  }
}

/**
 * Registers listeners so sync fires automatically:
 *  - immediately when the browser regains connectivity
 *  - every `intervalMs` as a safety net (default 60s) in case the
 *    'online' event is missed (some mobile browsers are unreliable here)
 * Returns a cleanup function.
 */
export function registerAutoSync(
  options: SyncEngineOptions,
  intervalMs = 60_000
): () => void {
  const handleOnline = () => void flushOutbox(options);
  window.addEventListener("online", handleOnline);

  const interval = setInterval(() => void flushOutbox(options), intervalMs);

  // Attempt an initial flush in case entries piled up before this
  // registered (e.g. app just launched after being offline).
  void flushOutbox(options);

  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(interval);
  };
}
