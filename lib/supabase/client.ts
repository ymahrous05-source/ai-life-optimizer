"use client";

// =====================================================================
// Supabase browser client — used in Client Components (auth forms,
// realtime hooks). Server Components/Actions use lib/supabase/server.ts.
// =====================================================================
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
