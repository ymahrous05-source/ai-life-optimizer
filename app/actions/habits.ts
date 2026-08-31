"use server";

// =====================================================================
// app/actions/habits.ts
// Called when a task's status flips to 'completed'. Surfaces any
// stacked habit prompts and records habit completions with streak math.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  getHabitPromptsForCompletedTask,
  computeUpdatedStreak,
  type HabitPrompt,
} from "../../lib/habits/habitStacking";
import { embedTaskOnCompletion } from "./taskDna";

export async function completeTaskAndGetHabitPrompts(
  taskId: string,
  actualMinutes?: number
): Promise<HabitPrompt[]> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      ...(actualMinutes ? { actual_minutes: actualMinutes } : {}),
    })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("id, title")
    .single();

  if (taskError || !task) throw taskError ?? new Error("Task not found");

  // Fire-and-forget-ish: build this task's DNA vector now that we know
  // how long it actually took. Awaited so failures surface in logs
  // rather than silently dropping, but doesn't block on habit prompts.
  if (actualMinutes) {
    await embedTaskOnCompletion(taskId).catch((err) =>
      console.error("Task DNA embedding failed:", err)
    );
  }

  const { data: habits } = await supabase
    .from("habits")
    .select("id, title, trigger_task_id, duration_minutes, current_streak, longest_streak, is_active")
    .eq("user_id", user.id)
    .eq("trigger_task_id", taskId)
    .eq("is_active", true);

  return getHabitPromptsForCompletedTask(
    task.id,
    task.title,
    (habits ?? []).map((h) => ({
      id: h.id,
      title: h.title,
      triggerTaskId: h.trigger_task_id,
      durationMinutes: h.duration_minutes,
      currentStreak: h.current_streak,
      longestStreak: h.longest_streak,
      isActive: h.is_active,
    }))
  );
}

export async function logHabitCompletion(habitId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: habit } = await supabase
    .from("habits")
    .select("current_streak, longest_streak")
    .eq("id", habitId)
    .single();

  const { data: lastLog } = await supabase
    .from("habit_logs")
    .select("completed_on")
    .eq("habit_id", habitId)
    .order("completed_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { currentStreak, longestStreak } = computeUpdatedStreak(
    { currentStreak: habit?.current_streak ?? 0, longestStreak: habit?.longest_streak ?? 0 },
    lastLog?.completed_on ?? null,
    todayIso
  );

  await supabase.from("habit_logs").upsert(
    { habit_id: habitId, user_id: user.id, completed_on: todayIso },
    { onConflict: "habit_id,completed_on" }
  );

  await supabase
    .from("habits")
    .update({ current_streak: currentStreak, longest_streak: longestStreak })
    .eq("id", habitId);
}
