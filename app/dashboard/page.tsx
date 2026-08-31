// =====================================================================
// app/dashboard/page.tsx
// Server Component: fetches the user's profile, today's tasks, and
// latest bio metrics from Supabase, computes the energy curve, then
// renders the client BioDashboard with bound Server Actions.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { buildEnergyCurve, autoRescheduleDay } from "../../lib/ai/autoRescheduleDay";
import { calculateBurnoutAndCorrection } from "../../lib/ai/calculateBurnoutAndCorrection";
import BioDashboard from "../../components/dashboard/BioDashboard";
import type { TimelineTask } from "../../components/dashboard/TimeBoxTimeline";
import type { EnergyLevel } from "../../lib/types";
import { createTaskFromVoice } from "../actions/voice";
import { logEnergyCheckIn } from "../actions/energy";
import { logHabitCompletion } from "../actions/habits";
import { getTodaysLifeScore } from "../actions/lifeScore";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deck-bg text-ink-primary">
        Please sign in to view your dashboard.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: todaysTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", authUser.id)
    .gte("scheduled_start", todayStart.toISOString())
    .lte("scheduled_start", todayEnd.toISOString())
    .order("scheduled_start", { ascending: true });

  const { data: recentEnergyLogs } = await supabase
    .from("energy_logs")
    .select("*")
    .eq("user_id", authUser.id)
    .gte("logged_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString())
    .order("logged_at", { ascending: true });

  const { data: recentFocusSessions } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", authUser.id)
    .gte("started_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString());

  const { data: completedTaskHistory } = await supabase
    .from("tasks")
    .select("estimated_minutes, actual_minutes, updated_at")
    .eq("user_id", authUser.id)
    .eq("status", "completed")
    .not("actual_minutes", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: activeHabits } = await supabase
    .from("habits")
    .select("id, title, duration_minutes, current_streak, longest_streak, trigger_task_id")
    .eq("user_id", authUser.id)
    .eq("is_active", true);

  const { data: todaysHabitLogs } = await supabase
    .from("habit_logs")
    .select("habit_id")
    .eq("user_id", authUser.id)
    .eq("completed_on", todayIso);

  const loggedHabitIds = new Set((todaysHabitLogs ?? []).map((l) => l.habit_id));

  const triggerTaskIds = (activeHabits ?? [])
    .map((h) => h.trigger_task_id)
    .filter((id): id is string => Boolean(id));

  const { data: triggerTasks } =
    triggerTaskIds.length > 0
      ? await supabase.from("tasks").select("id, title").in("id", triggerTaskIds)
      : { data: [] as { id: string; title: string }[] };

  const triggerTitleById = new Map((triggerTasks ?? []).map((t) => [t.id, t.title]));

  const habitListItems = (activeHabits ?? []).map((h) => ({
    id: h.id,
    title: h.title,
    triggerTaskTitle: h.trigger_task_id ? triggerTitleById.get(h.trigger_task_id) ?? null : null,
    durationMinutes: h.duration_minutes,
    currentStreak: h.current_streak,
    longestStreak: h.longest_streak,
    loggedToday: loggedHabitIds.has(h.id),
  }));

  const lifeScore = await getTodaysLifeScore();

  const energyCurveMap = buildEnergyCurve(
    profile?.chronotype ?? "bear",
    profile?.cortisol_peak_hour ?? 8,
    profile?.cortisol_trough_hour ?? 15
  );
  const energyCurve: Record<number, EnergyLevel> = Object.fromEntries(energyCurveMap);

  const burnout = calculateBurnoutAndCorrection({
    taskHistory: (completedTaskHistory ?? []).map((t) => ({
      estimatedMinutes: t.estimated_minutes,
      actualMinutes: t.actual_minutes,
      completedAt: t.updated_at,
    })),
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
    previousCorrectionFactor: profile?.planning_correction_factor ?? 1.0,
  });

  const latestLoad =
    recentEnergyLogs && recentEnergyLogs.length > 0
      ? recentEnergyLogs[recentEnergyLogs.length - 1].cognitive_load_remaining ?? 100
      : 100;

  const timelineTasks: TimelineTask[] = (todaysTasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    requiredEnergy: t.required_energy,
    startHour: t.scheduled_start ? new Date(t.scheduled_start).getHours() : 9,
    durationMinutes: t.corrected_minutes ?? t.estimated_minutes,
    status: t.status,
  }));

  const delayedMinutesToday = (todaysTasks ?? [])
    .filter((t) => t.status === "missed")
    .reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);

  // ---- Server Actions bound into the client component ----
  async function runSmartReschedule(): Promise<TimelineTask[]> {
    "use server";
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return [];

    const { data: pendingTasks } = await sb
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["backlog", "scheduled"]);

    const { data: userProfile } = await sb.from("users").select("*").eq("id", user.id).single();

    const result = autoRescheduleDay({
      user: {
        chronotype: userProfile?.chronotype ?? "bear",
        cortisolPeakHour: userProfile?.cortisol_peak_hour ?? 8,
        cortisolTroughHour: userProfile?.cortisol_trough_hour ?? 15,
        workStartTime: userProfile?.work_start_time ?? "09:00",
        workEndTime: userProfile?.work_end_time ?? "18:00",
      },
      tasks: (pendingTasks ?? []).map((t) => ({
        id: t.id,
        estimatedMinutes: t.estimated_minutes,
        correctedMinutes: t.corrected_minutes,
        requiredEnergy: t.required_energy,
        codValue: t.cod_value,
        codUrgencyProfile: t.cod_urgency_profile,
        isHardDeadline: t.is_hard_deadline,
        deadlineAt: t.deadline_at,
        bufferMinutesBefore: t.buffer_minutes_before,
        bufferMinutesAfter: t.buffer_minutes_after,
      })),
      targetDate: new Date(),
    });

    for (const scheduled of result.scheduled) {
      await sb
        .from("tasks")
        .update({
          scheduled_start: scheduled.scheduledStart,
          scheduled_end: scheduled.scheduledEnd,
          status: "scheduled",
        })
        .eq("id", scheduled.id);
    }

    const { data: refreshed } = await sb
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .gte("scheduled_start", todayStart.toISOString())
      .lte("scheduled_start", todayEnd.toISOString());

    return (refreshed ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      requiredEnergy: t.required_energy,
      startHour: t.scheduled_start ? new Date(t.scheduled_start).getHours() : 9,
      durationMinutes: t.corrected_minutes ?? t.estimated_minutes,
      status: t.status,
    }));
  }

  async function logTaskMove(taskId: string, newStartHour: number): Promise<void> {
    "use server";
    const sb = await createSupabaseServerClient();
    const newStart = new Date();
    newStart.setHours(newStartHour, 0, 0, 0);
    await sb.from("tasks").update({ scheduled_start: newStart.toISOString() }).eq("id", taskId);
  }

  async function startNsdrSession(): Promise<void> {
    "use server";
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("focus_sessions").insert({
      user_id: user.id,
      session_type: "nsdr",
      planned_minutes: 15,
    });
  }

  async function onVoiceTranscript(transcript: string): Promise<void> {
    "use server";
    await createTaskFromVoice(transcript);
  }

  return (
    <BioDashboard
      userName={profile?.full_name ?? "there"}
      hourlyRate={profile?.hourly_rate ?? 0}
      energyCurve={energyCurve}
      initialTasks={timelineTasks}
      mentalBatteryPercent={latestLoad}
      delayedMinutesToday={delayedMinutesToday}
      burnoutRiskScore={burnout.burnoutRiskScore}
      habits={habitListItems}
      lifeScore={lifeScore}
      runSmartReschedule={runSmartReschedule}
      logTaskMove={logTaskMove}
      startNsdrSession={startNsdrSession}
      onVoiceTranscript={onVoiceTranscript}
      onLogEnergy={logEnergyCheckIn}
      onLogHabit={logHabitCompletion}
    />
  );
}
