"use server";

// =====================================================================
// app/actions/goals.ts
// Server Actions for goal creation: decomposes a goal into sub-tasks
// via Gemini, persists goal + tasks, and optionally reverse-time-blocks
// them against a hard target date.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { decomposeGoalWithGemini } from "../../lib/ai/decomposeGoalWithGemini";
import { reverseTimeBlock } from "../../lib/scheduling/reverseTimeBlock";
import type { DecomposedSubtask } from "../../lib/types";

export interface CreateGoalInput {
  title: string;
  description?: string;
  targetDate?: string; // ISO date, optional
  useReverseBlocking: boolean;
  dailyCapacityMinutes?: number; // used only if useReverseBlocking
  precomputedSubtasks?: DecomposedSubtask[]; // pass through from previewGoalDecomposition to skip re-decomposing
}

export interface CreateGoalResult {
  goalId: string;
  subtaskCount: number;
  reverseFeasible: boolean | null;
}

/**
 * Decomposes a goal WITHOUT saving anything — used to preview sub-tasks
 * (and run the Monte Carlo pre-mortem against them) before the user
 * commits. Call createGoalWithDecomposition afterward, passing the
 * returned subtasks as `precomputedSubtasks` to avoid a duplicate
 * Gemini call.
 */
export async function previewGoalDecomposition(input: {
  title: string;
  description?: string;
  targetDate?: string;
}): Promise<DecomposedSubtask[]> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("users")
    .select("chronotype, hourly_rate, work_start_time, work_end_time")
    .eq("id", user.id)
    .single();

  const workHoursPerDay = profile
    ? hoursBetween(profile.work_start_time, profile.work_end_time)
    : 8;

  return decomposeGoalWithGemini({
    goalTitle: input.title,
    goalDescription: input.description,
    targetDate: input.targetDate,
    userContext: {
      chronotype: profile?.chronotype ?? "bear",
      hourlyRate: profile?.hourly_rate ?? 0,
      workHoursPerDay,
    },
  });
}

export async function createGoalWithDecomposition(
  input: CreateGoalInput
): Promise<CreateGoalResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("users")
    .select("chronotype, hourly_rate, work_start_time, work_end_time")
    .eq("id", user.id)
    .single();

  const workHoursPerDay = profile
    ? hoursBetween(profile.work_start_time, profile.work_end_time)
    : 8;

  // 1. Decompose the goal into sub-tasks via Gemini — unless the caller
  // already ran previewGoalDecomposition() and is passing the result
  // through (e.g. after showing the pre-mortem and getting confirmation).
  const subtasks =
    input.precomputedSubtasks ??
    (await decomposeGoalWithGemini({
      goalTitle: input.title,
      goalDescription: input.description,
      targetDate: input.targetDate,
      userContext: {
        chronotype: profile?.chronotype ?? "bear",
        hourlyRate: profile?.hourly_rate ?? 0,
        workHoursPerDay,
      },
    }));

  // 2. Insert the goal row.
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description ?? null,
      target_date: input.targetDate ?? null,
      is_reverse_planned: input.useReverseBlocking,
    })
    .select()
    .single();

  if (goalError || !goal) throw goalError ?? new Error("Failed to create goal");

  // 3. Compute schedule for sub-tasks: reverse-blocked if requested and a
  // target date exists, otherwise left unscheduled for the AI Rescheduling
  // Engine (autoRescheduleDay) to place later.
  let reverseFeasible: boolean | null = null;
  let scheduleByIndex: Map<number, { start: string; end: string }> | null = null;

  if (input.useReverseBlocking && input.targetDate) {
    const result = reverseTimeBlock({
      targetDate: new Date(input.targetDate),
      subtasks: subtasks.map((s, i) => ({
        id: String(i), // temp id, real task IDs don't exist yet
        title: s.title,
        estimatedMinutes: s.estimatedMinutes,
        orderIndex: i,
      })),
      dailyCapacityMinutes: input.dailyCapacityMinutes ?? 240,
      workStartHour: profile?.work_start_time
        ? Number(profile.work_start_time.split(":")[0])
        : 9,
    });

    reverseFeasible = result.feasible;
    scheduleByIndex = new Map(
      result.placements.map((p) => [Number(p.id), { start: p.scheduledStart, end: p.scheduledEnd }])
    );
  }

  // 4. Insert sub-tasks, linked to the goal.
  const rows = subtasks.map((s, i) => ({
    user_id: user.id,
    goal_id: goal.id,
    title: s.title,
    description: s.description,
    estimated_minutes: s.estimatedMinutes,
    required_energy: s.requiredEnergy,
    eisenhower_quadrant: s.eisenhowerQuadrant,
    moscow: s.moscow,
    status: scheduleByIndex ? "scheduled" : "backlog",
    scheduled_start: scheduleByIndex?.get(i)?.start ?? null,
    scheduled_end: scheduleByIndex?.get(i)?.end ?? null,
    is_hard_deadline: Boolean(input.targetDate) && i === subtasks.length - 1,
    deadline_at: i === subtasks.length - 1 ? input.targetDate ?? null : null,
  }));

  const { error: tasksError } = await supabase.from("tasks").insert(rows);
  if (tasksError) throw tasksError;

  return { goalId: goal.id, subtaskCount: subtasks.length, reverseFeasible };
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}
