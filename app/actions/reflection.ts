"use server";

// =====================================================================
// app/actions/reflection.ts
// Aggregates the day's data, calls the Gemini reflection coach, and
// persists the user's answers to the `reflections` table.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { generateDailyReflectionSummary } from "../../lib/ai/generateDailyReflectionSummary";
import { calculateBurnoutAndCorrection } from "../../lib/ai/calculateBurnoutAndCorrection";

export async function generateTodaysReflection() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString().slice(0, 10);

  const { data: todaysTasks } = await supabase
    .from("tasks")
    .select("status, estimated_minutes")
    .eq("user_id", user.id)
    .gte("scheduled_start", todayStart.toISOString());

  const { data: todaysFocusSessions } = await supabase
    .from("focus_sessions")
    .select("planned_minutes, was_interrupted, session_type")
    .eq("user_id", user.id)
    .gte("started_at", todayStart.toISOString());

  const { data: todaysHabitLogs } = await supabase
    .from("habit_logs")
    .select("habit_id, habits(title)")
    .eq("user_id", user.id)
    .eq("completed_on", todayIso);

  const { data: activeHabits } = await supabase
    .from("habits")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const completedHabitIds = new Set((todaysHabitLogs ?? []).map((l) => l.habit_id));
  const habitsCompleted = (todaysHabitLogs ?? [])
    .map((l: any) => l.habits?.title)
    .filter(Boolean) as string[];
  const habitsMissed = (activeHabits ?? [])
    .filter((h) => !completedHabitIds.has(h.id))
    .map((h) => h.title);

  const tasksCompleted = (todaysTasks ?? []).filter((t) => t.status === "completed").length;
  const tasksMissed = (todaysTasks ?? []).filter((t) => t.status === "missed").length;
  const totalFocusMinutes = (todaysFocusSessions ?? [])
    .filter((s) => s.session_type === "deep_work" || s.session_type === "lockdown")
    .reduce((sum, s) => sum + s.planned_minutes, 0);
  const interruptedSessions = (todaysFocusSessions ?? []).filter((s) => s.was_interrupted).length;

  const { data: profile } = await supabase
    .from("users")
    .select("hourly_rate, planning_correction_factor")
    .eq("id", user.id)
    .single();

  const missedMinutes = (todaysTasks ?? [])
    .filter((t) => t.status === "missed")
    .reduce((sum, t) => sum + t.estimated_minutes, 0);
  const financialCostOfDelay = (missedMinutes / 60) * (profile?.hourly_rate ?? 0);

  const burnout = calculateBurnoutAndCorrection({
    taskHistory: [],
    recentFocusSessions: (todaysFocusSessions ?? []).map((s) => ({
      plannedMinutes: s.planned_minutes,
      wasInterrupted: s.was_interrupted,
      sessionType: s.session_type,
      startedAt: new Date().toISOString(),
    })),
    recentEnergyLogs: [],
    previousCorrectionFactor: profile?.planning_correction_factor ?? 1,
  });

  const reflection = await generateDailyReflectionSummary({
    date: todayIso,
    tasksCompleted,
    tasksMissed,
    totalFocusMinutes,
    interruptedSessions,
    burnoutRiskScore: burnout.burnoutRiskScore,
    habitsCompleted,
    habitsMissed,
    financialCostOfDelay,
  });

  return { reflection, tasksCompleted, tasksMissed, financialCostOfDelay };
}

export async function saveReflectionAnswers(
  answers: { question: string; answer: string }[],
  mood: string,
  meta: { tasksCompleted: number; tasksMissed: number; financialCostOfDelay: number }
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const todayIso = new Date().toISOString().slice(0, 10);
  const wins = answers.map((a) => `${a.question}\n${a.answer}`).join("\n\n");

  await supabase.from("reflections").upsert(
    {
      user_id: user.id,
      reflection_date: todayIso,
      mood,
      wins,
      tasks_completed: meta.tasksCompleted,
      tasks_missed: meta.tasksMissed,
      financial_cost_of_delay: meta.financialCostOfDelay,
    },
    { onConflict: "user_id,reflection_date" }
  );
}
