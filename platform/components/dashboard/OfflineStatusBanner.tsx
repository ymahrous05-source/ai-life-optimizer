"use client";

// =====================================================================
// OfflineStatusBanner
// Small always-visible pill showing whether the app is online, and how
// many locally-queued mutations are still waiting to sync. Lets the
// user confirm at a glance that "I logged that offline" really did
// make it to the server, or trigger a sync manually instead of waiting
// for the automatic listener/interval in syncEngine.ts.
// =====================================================================
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOutboxEntries } from "../../lib/offline/db";
import { flushOutbox } from "../../lib/offline/syncEngine";

interface OfflineStatusBannerProps {
  supabase: SupabaseClient;
}

export default function OfflineStatusBanner({ supabase }: OfflineStatusBannerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const refreshCount = () => {
      getOutboxEntries()
        .then((entries) => setPendingCount(entries.length))
        .catch(() => {});
    };
    refreshCount();
    const interval = setInterval(refreshCount, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  async function handleSyncNow() {
    setSyncing(true);
    await flushOutbox({
      supabase,
      onSyncComplete: () => {
        getOutboxEntries()
          .then((entries) => setPendingCount(entries.length))
          .catch(() => {});
      },
    });
    setSyncing(false);
  }

  if (isOnline && pendingCount === 0) {
    return (
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-success" />
        Online — synced
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-deck-line bg-deck-surfaceRaised px-3 py-1">
      <span
        className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-signal-info" : "bg-signal-cost"}`}
      />
      <span className="font-mono text-[10px] text-ink-muted">
        {isOnline ? "Online" : "Offline — working locally"}
        {pendingCount > 0 && ` · ${pendingCount} queued`}
      </span>
      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSyncNow}
          disabled={syncing}
          className="font-mono text-[10px] text-signal-info underline decoration-dotted disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      )}
    </div>
  );
}
