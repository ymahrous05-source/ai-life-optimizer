"use server";

// =====================================================================
// app/actions/reports.ts
// Fetches this week's (and last week's, for trend deltas) energy_logs,
// focus_sessions, and completed tasks, then reduces them to a single
// WeeklyPerformanceReport via lib/reports/weeklyPerformanceReport.ts.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  computeWeeklyPerformanceReport,
  type WeeklyPerformanceReport,
} from "../../lib/reports/weeklyPerformanceReport";

const DAY_MS = 24 * 3600_000;

export async function getWeeklyPerformanceReport(): Promise<WeeklyPerformanceReport> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const weekStart = new Date(now - 7 * DAY_MS).toISOString();
  const twoWeeksStart = new Date(now - 14 * DAY_MS).toISOString();

  const [
    { data: energyLogs },
    { data: focusSessions },
    { data: completedTasks },
    { data: previousFocusSessions },
    { data: previousCompletedTasks },
  ] = await Promise.all([
    supabase
      .from("energy_logs")
      .select("logged_at, energy_level")
      .eq("user_id", user.id)
      .gte("logged_at", weekStart),
    supabase
      .from("focus_sessions")
      .select("started_at, planned_minutes, ended_at, was_interrupted")
      .eq("user_id", user.id)
      .gte("started_at", weekStart),
    supabase
      .from("tasks")
      .select("updated_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("updated_at", weekStart),
    supabase
      .from("focus_sessions")
      .select("started_at, planned_minutes, ended_at, was_interrupted")
      .eq("user_id", user.id)
      .gte("started_at", twoWeeksStart)
      .lt("started_at", weekStart),
    supabase
      .from("tasks")
      .select("updated_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("updated_at", twoWeeksStart)
      .lt("updated_at", weekStart),
  ]);

  return computeWeeklyPerformanceReport({
    energyLogs: (energyLogs ?? []).map((e) => ({
      loggedAt: e.logged_at,
      energyLevel: e.energy_level,
    })),
    focusSessions: (focusSessions ?? []).map((s) => ({
      startedAt: s.started_at,
      plannedMinutes: s.planned_minutes,
      endedAt: s.ended_at,
      wasInterrupted: s.was_interrupted ?? false,
    })),
    completedTasks: (completedTasks ?? []).map((t) => ({ completedAt: t.updated_at })),
    previousWeek: {
      focusSessions: (previousFocusSessions ?? []).map((s) => ({
        startedAt: s.started_at,
        plannedMinutes: s.planned_minutes,
        endedAt: s.ended_at,
        wasInterrupted: s.was_interrupted ?? false,
      })),
      completedTasks: (previousCompletedTasks ?? []).map((t) => ({ completedAt: t.updated_at })),
    },
  });
}
