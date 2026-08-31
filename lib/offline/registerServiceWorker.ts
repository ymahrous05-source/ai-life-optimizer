"use client";

// =====================================================================
// registerServiceWorker()
// Call once from a top-level client component (e.g. app/providers.tsx).
// Registers the service worker and wires its postMessage("FLUSH_OUTBOX")
// signal (fired by the Background Sync API) into the syncEngine.
// =====================================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { flushOutbox } from "./syncEngine";

export function registerServiceWorker(supabase: SupabaseClient): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "FLUSH_OUTBOX") {
          void flushOutbox({ supabase });
        }
      });

      // Request a background sync so pending mutations flush even if the
      // tab is closed shortly after going offline -> online. Not all
      // browsers support this (notably Safari); the periodic interval in
      // registerAutoSync() is the fallback for those.
      if ("sync" in registration) {
        // @ts-expect-error — SyncManager isn't in the default TS lib yet
        await registration.sync.register("flush-outbox").catch(() => {
          // Silently ignore — periodic interval fallback still applies.
        });
      }
    } catch (err) {
      console.error("Service worker registration failed:", err);
    }
  });
}
