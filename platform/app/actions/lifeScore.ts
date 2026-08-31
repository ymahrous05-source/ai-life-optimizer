"use server";

// =====================================================================
// app/actions/lifeScore.ts
// Aggregates mental battery, burnout risk, 7-day habit consistency,
// and time-since-last-activity into a single Life Score, then upserts
// today's snapshot so tomorrow's trend has something real to compare
// against.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { computeLifeScore, type LifeScoreResult } from "../../lib/life/computeLifeScore";
import { calculateBurnoutAndCorrection } from "../../lib/ai/calculateBurnoutAndCorrection";

export async function getTodaysLifeScore(): Promise<LifeScoreResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const todayIso = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 48 * 3600_000).toISOString();

  const [
    { data: recentEnergyLogs },
    { data: recentFocusSessions },
    { data: profile },
    { data: activeHabits },
    { data: recentHabitLogs },
    { data: yesterdayScore },
  ] = await Promise.all([
    supabase
      .from("energy_logs")
      .select("logged_at, cognitive_load_remaining")
      .eq("user_id", user.id)
      .gte("logged_at", twoDaysAgo)
      .order("logged_at", { ascending: true }),
    supabase
      .from("focus_sessions")
      .select("planned_minutes, was_interrupted, session_type, started_at")
      .eq("user_id", user.id)
      .gte("started_at", twoDaysAgo),
    supabase.from("users").select("planning_correction_factor").eq("id", user.id).single(),
    supabase.from("habits").select("id, current_streak").eq("user_id", user.id).eq("is_active", true),
    supabase
      .from("habit_logs")
      .select("habit_id, completed_on")
      .eq("user_id", user.id)
      .gte("completed_on", sevenDaysAgo.slice(0, 10)),
    supabase
      .from("life_score_history")
      .select("score")
      .eq("user_id", user.id)
      .lt("recorded_on", todayIso)
      .order("recorded_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const burnout = calculateBurnoutAndCorrection({
    taskHistory: [],
    recentFocusSessions: (recentFocusSessions ?? []).map((s) => ({
      plannedMinutes: s.planned_minutes,
      wasInterrupted: s.was_interrupted,
      sessionType: s.session_type,
      startedAt: s.started_at,
    })),
    recentEnergyLogs: (recentEnergyLogs ?? []).map((e) => ({
      loggedAt: e.logged_at,
      cognitiveLoadRemaining: e.cognitive_load_remaining ?? 100,
    })),
    previousCorrectionFactor: profile?.planning_correction_factor ?? 1,
  });

  const mentalBatteryPercent =
    recentEnergyLogs && recentEnergyLogs.length > 0
      ? recentEnergyLogs[recentEnergyLogs.length - 1].cognitive_load_remaining ?? 100
      : 100;

  const activeHabitCount = activeHabits?.length ?? 0;
  const possibleHabitDays = activeHabitCount * 7;
  const habitCompletionRate7d =
    possibleHabitDays > 0 ? Math.min(1, (recentHabitLogs?.length ?? 0) / possibleHabitDays) : 1;

  const currentStreakDays = (activeHabits ?? []).reduce(
    (max, h) => Math.max(max, h.current_streak ?? 0),
    0
  );

  const lastActivityAt =
    recentEnergyLogs && recentEnergyLogs.length > 0
      ? new Date(recentEnergyLogs[recentEnergyLogs.length - 1].logged_at)
      : recentFocusSessions && recentFocusSessions.length > 0
      ? new Date(
          recentFocusSessions.sort(
            (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          )[0].started_at
        )
      : new Date(Date.now() - 48 * 3600_000);

  const hoursSinceLastCheckIn = (Date.now() - lastActivityAt.getTime()) / 3600_000;

  const result = computeLifeScore(
    {
      mentalBatteryPercent,
      burnoutRiskScore: burnout.burnoutRiskScore,
      habitCompletionRate7d,
      hoursSinceLastCheckIn,
      currentStreakDays,
    },
    yesterdayScore?.score
  );

  await supabase.from("life_score_history").upsert(
    {
      user_id: user.id,
      recorded_on: todayIso,
      score: result.score,
      band: result.band,
    },
    { onConflict: "user_id,recorded_on" }
  );

  return result;
}
