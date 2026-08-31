// =====================================================================
// reverseTimeBlock()
// Backward scheduling: given a hard target_date and a list of subtasks
// (already decomposed, e.g. via decomposeGoalWithGemini), it walks
// backwards from the deadline, placing the LAST subtask right before
// the deadline, then working earlier for each preceding subtask —
// respecting daily work-hour capacity and skipping weekends by default.
// =====================================================================

export interface ReverseBlockSubtask {
  id: string;
  title: string;
  estimatedMinutes: number;
  orderIndex: number; // execution order — index 0 must happen first
}

export interface ReverseBlockPlacement {
  id: string;
  title: string;
  scheduledStart: string; // ISO
  scheduledEnd: string; // ISO
}

export interface ReverseTimeBlockInput {
  targetDate: Date; // hard deadline
  subtasks: ReverseBlockSubtask[];
  dailyCapacityMinutes: number; // e.g. 4 hours of focused work/day = 240
  workStartHour: number; // e.g. 9
  skipWeekends?: boolean;
  now?: Date;
}

export interface ReverseTimeBlockResult {
  placements: ReverseBlockPlacement[];
  feasible: boolean; // false if the plan would need to start before today
  daysNeeded: number;
  overflowMinutes: number; // minutes that didn't fit if infeasible
}

export function reverseTimeBlock(input: ReverseTimeBlockInput): ReverseTimeBlockResult {
  const now = input.now ?? new Date();
  const skipWeekends = input.skipWeekends ?? true;

  // Process subtasks in REVERSE execution order — the last thing that
  // must happen gets placed closest to the deadline.
  const orderedDescending = [...input.subtasks].sort((a, b) => b.orderIndex - a.orderIndex);

  const placements: ReverseBlockPlacement[] = [];

  let cursorDate = stripTime(input.targetDate);
  let minutesUsedToday = 0;

  // Start the cursor at the deadline day, filling capacity from the end
  // of the day backwards conceptually — simplified here by filling from
  // workStartHour forward but consuming daily budget in reverse subtask order.
  for (const task of orderedDescending) {
    let remaining = task.estimatedMinutes;
    const segments: { start: Date; end: Date }[] = [];

    while (remaining > 0) {
      if (skipWeekends && isWeekend(cursorDate)) {
        cursorDate = addDays(cursorDate, -1);
        minutesUsedToday = 0;
        continue;
      }

      const capacityLeftToday = input.dailyCapacityMinutes - minutesUsedToday;

      if (capacityLeftToday <= 0) {
        cursorDate = addDays(cursorDate, -1);
        minutesUsedToday = 0;
        continue;
      }

      const chunk = Math.min(remaining, capacityLeftToday);
      const segmentStartMinuteOfDay =
        input.workStartHour * 60 + minutesUsedToday;
      const segStart = new Date(cursorDate);
      segStart.setHours(0, segmentStartMinuteOfDay, 0, 0);
      const segEnd = new Date(segStart.getTime() + chunk * 60000);

      segments.push({ start: segStart, end: segEnd });
      minutesUsedToday += chunk;
      remaining -= chunk;
    }

    // Merge same-day contiguous segments into one placement per task
    // (multi-day tasks get their earliest-start/latest-end collapsed —
    // acceptable simplification for a v1 reverse-blocking view).
    const earliestStart = segments.reduce(
      (min, s) => (s.start < min ? s.start : min),
      segments[0].start
    );
    const latestEnd = segments.reduce(
      (max, s) => (s.end > max ? s.end : max),
      segments[0].end
    );

    placements.push({
      id: task.id,
      title: task.title,
      scheduledStart: earliestStart.toISOString(),
      scheduledEnd: latestEnd.toISOString(),
    });
  }

  const earliestPlacement = placements.reduce(
    (min, p) => (new Date(p.scheduledStart) < new Date(min.scheduledStart) ? p : min),
    placements[0]
  );

  const feasible = earliestPlacement
    ? new Date(earliestPlacement.scheduledStart) >= stripTime(now)
    : true;

  const daysNeeded = Math.max(
    1,
    Math.round(
      (stripTime(input.targetDate).getTime() -
        (earliestPlacement ? stripTime(new Date(earliestPlacement.scheduledStart)).getTime() : stripTime(now).getTime())) /
        (1000 * 60 * 60 * 24)
    )
  );

  const overflowMinutes = feasible
    ? 0
    : Math.round(
        (stripTime(now).getTime() - stripTime(new Date(earliestPlacement.scheduledStart)).getTime()) /
          60000
      );

  return {
    // Return in forward chronological (execution) order for display.
    placements: placements.reverse(),
    feasible,
    daysNeeded,
    overflowMinutes,
  };
}

function stripTime(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}
