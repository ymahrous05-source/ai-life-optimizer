"use server";

// =====================================================================
// app/actions/energy.ts
// Persists a manual energy check-in (from <EnergyCheckIn />) to the
// energy_logs table.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type { EnergyLevel } from "../../lib/types";

export async function logEnergyCheckIn(
  level: EnergyLevel,
  cognitiveLoadRemaining: number
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("energy_logs").insert({
    user_id: user.id,
    energy_level: level,
    cognitive_load_remaining: cognitiveLoadRemaining,
    source: "manual",
  });
}
