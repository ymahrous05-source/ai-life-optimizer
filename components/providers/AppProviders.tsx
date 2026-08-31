"use client";

// =====================================================================
// AppProviders
// Root client wrapper: registers the PWA service worker and starts the
// offline outbox auto-sync engine once, at the top of the app. Mounted
// from app/layout.tsx (a Server Component) so the rest of the tree can
// stay server-rendered by default.
// =====================================================================
import { useEffect } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { registerServiceWorker } from "../../lib/offline/registerServiceWorker";
import { registerAutoSync } from "../../lib/offline/syncEngine";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    registerServiceWorker(supabase);
    const cleanup = registerAutoSync({ supabase });
    return cleanup;
  }, []);

  return <>{children}</>;
}
