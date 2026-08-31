"use server";

// =====================================================================
// app/actions/premortem.ts
// Pulls the user's actual historical estimate-vs-actual variance and
// interruption rate, then runs the Monte Carlo pre-mortem against a
// draft goal's subtasks and target date.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { runGoalPremortem, type PremortemResult } from "../../lib/scheduling/goalPremortem";
import type { DecomposedSubtask } from "../../lib/types";

export async function getGoalPremortem(
  subtasks: Pick<DecomposedSubtask, "estimatedMinutes">[],
  targetDate: string,
  dailyCapacityMinutes: number
): Promise<PremortemResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: history } = await supabase
    .from("tasks")
    .select("estimated_minutes, actual_minutes")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .not("actual_minutes", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  const { data: recentSessions } = await supabase
    .from("focus_sessions")
    .select("was_interrupted")
    .eq("user_id", user.id)
    .in("session_type", ["deep_work", "lockdown"])
    .gte("started_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString());

  const { mean, stdDev } = computeCorrectionStats(history ?? []);

  const interruptionRate =
    recentSessions && recentSessions.length > 0
      ? recentSessions.filter((s) => s.was_interrupted).length / recentSessions.length
      : 0.15; // reasonable default with no history yet

  return runGoalPremortem({
    subtasks,
    targetDate: new Date(targetDate),
    now: new Date(),
    dailyCapacityMinutes,
    meanCorrectionFactor: mean,
    correctionFactorStdDev: stdDev,
    interruptionRate,
  });
}

function computeCorrectionStats(
  history: { estimated_minutes: number; actual_minutes: number }[]
): { mean: number; stdDev: number } {
  if (history.length < 3) {
    // Not enough personal data yet — use a mildly conservative default
    // with meaningful spread rather than pretending to be certain.
    return { mean: 1.2, stdDev: 0.35 };
  }

  const ratios = history
    .filter((h) => h.estimated_minutes > 0)
    .map((h) => Math.min(4, Math.max(0.25, h.actual_minutes / h.estimated_minutes)));

  const mean = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;
  const stdDev = Math.max(0.1, Math.sqrt(variance));

  return { mean, stdDev };
}
