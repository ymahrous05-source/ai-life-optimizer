// =====================================================================
// Micro-Habit Stacking Engine (Atomic Habits methodology)
//
// A habit is "stacked" onto a trigger task: whenever the trigger task
// is marked complete, the linked habit is surfaced as a suggested
// next micro-action ("After [trigger], I will [habit]"). This module
// contains the pure logic; wiring to Supabase happens in the caller
// (e.g. a Server Action invoked when a task's status flips to 'completed').
// =====================================================================

export interface HabitDefinition {
  id: string;
  title: string;
  triggerTaskId: string | null;
  durationMinutes: number;
  currentStreak: number;
  longestStreak: number;
  isActive: boolean;
}

export interface HabitLogEntry {
  habitId: string;
  completedOn: string; // ISO date (YYYY-MM-DD)
}

export interface HabitPrompt {
  habitId: string;
  habitTitle: string;
  triggerTaskId: string;
  stackPhrase: string; // "After finishing X, spend 2 min on Y"
  durationMinutes: number;
}

/**
 * Given the task that was just completed, returns any habits stacked
 * on it as prompts the UI should surface immediately (e.g. a toast or
 * inline card right after task completion).
 */
export function getHabitPromptsForCompletedTask(
  completedTaskId: string,
  completedTaskTitle: string,
  habits: HabitDefinition[]
): HabitPrompt[] {
  return habits
    .filter((h) => h.isActive && h.triggerTaskId === completedTaskId)
    .map((h) => ({
      habitId: h.id,
      habitTitle: h.title,
      triggerTaskId: completedTaskId,
      stackPhrase: `After finishing "${completedTaskTitle}", spend ${h.durationMinutes} min on: ${h.title}`,
      durationMinutes: h.durationMinutes,
    }));
}

/**
 * Streak calculation: given prior streak state and a new completion
 * for `today`, determines the updated streak. A habit's streak resets
 * to 1 if there was a gap of more than one day since the last log.
 */
export function computeUpdatedStreak(
  habit: Pick<HabitDefinition, "currentStreak" | "longestStreak">,
  lastCompletedOn: string | null, // ISO date of the previous completion, or null
  newCompletionDate: string // ISO date (YYYY-MM-DD) of today's completion
): { currentStreak: number; longestStreak: number } {
  let currentStreak: number;

  if (!lastCompletedOn) {
    currentStreak = 1;
  } else {
    const dayDiff = daysBetween(lastCompletedOn, newCompletionDate);
    if (dayDiff === 0) {
      // Already logged today — no change.
      currentStreak = habit.currentStreak;
    } else if (dayDiff === 1) {
      currentStreak = habit.currentStreak + 1;
    } else {
      currentStreak = 1; // streak broken
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(habit.longestStreak, currentStreak),
  };
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T00:00:00Z").getTime();
  const b = new Date(isoB + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Detects habits at risk of breaking today — i.e. active habits whose
 * streak is > 0 but haven't been logged yet today. Useful for a
 * gentle end-of-day nudge notification.
 */
export function getHabitsAtRiskToday(
  habits: HabitDefinition[],
  todaysLogs: HabitLogEntry[],
  todayIso: string
): HabitDefinition[] {
  const loggedTodayIds = new Set(
    todaysLogs.filter((l) => l.completedOn === todayIso).map((l) => l.habitId)
  );
  return habits.filter(
    (h) => h.isActive && h.currentStreak > 0 && !loggedTodayIds.has(h.id)
  );
}
