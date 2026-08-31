// =====================================================================
// autoRescheduleDay()
//
// Dynamic daily scheduler. Given a user's chronotype/cortisol profile
// and a set of pending tasks, it:
//   1. Builds an hour-by-hour energy curve for the day.
//   2. Computes a WSJF-style dynamic priority score per task from its
//      Cost-of-Delay value and estimated duration.
//   3. Greedily places tasks into open slots, preferring slots whose
//      energy level matches (or exceeds) the task's required_energy,
//      respecting hard deadlines, fixed events, and configured buffers.
//   4. Defers anything that doesn't fit back to the backlog rather than
//      overpacking the day.
// =====================================================================
import type {
  EnergyLevel,
  RescheduleResult,
  Task,
  UserProfile,
} from "../types";

const ENERGY_RANK: Record<EnergyLevel, number> = {
  trough: 0,
  low: 1,
  medium: 2,
  high: 3,
  peak: 4,
};

interface FixedEvent {
  start: Date;
  end: Date;
}

interface SchedulableTask
  extends Pick<
    Task,
    | "id"
    | "estimatedMinutes"
    | "correctedMinutes"
    | "requiredEnergy"
    | "codValue"
    | "codUrgencyProfile"
    | "isHardDeadline"
    | "deadlineAt"
    | "bufferMinutesBefore"
    | "bufferMinutesAfter"
  > {}

interface AutoRescheduleInput {
  user: Pick<
    UserProfile,
    | "chronotype"
    | "cortisolPeakHour"
    | "cortisolTroughHour"
    | "workStartTime"
    | "workEndTime"
  >;
  tasks: SchedulableTask[];
  targetDate: Date; // day being scheduled, local to user's timezone
  fixedEvents?: FixedEvent[]; // calendar blocks that must not be touched
  now?: Date; // injectable for testing; defaults to current time
}

/**
 * Cost-of-Delay / duration -> WSJF-style priority score.
 * Higher = schedule sooner. Hard deadlines get an urgency multiplier
 * that grows sharply as the deadline approaches.
 */
export function computeDynamicPriorityScore(
  task: SchedulableTask,
  now: Date
): number {
  const durationHours = Math.max(0.25, (task.correctedMinutes ?? task.estimatedMinutes) / 60);
  const baseWsjf = task.codValue / durationHours;

  if (!task.isHardDeadline || !task.deadlineAt) {
    return baseWsjf;
  }

  const hoursUntilDeadline = Math.max(
    0.1,
    (new Date(task.deadlineAt).getTime() - now.getTime()) / (1000 * 60 * 60)
  );

  // Urgency multiplier grows as deadline approaches; inverse relationship,
  // capped so it doesn't produce Infinity for near-zero hours remaining.
  const urgencyMultiplier = Math.min(50, 48 / hoursUntilDeadline);

  return baseWsjf * (1 + urgencyMultiplier);
}

/**
 * Builds an hour -> EnergyLevel map for the target day based on the
 * user's chronotype and self-reported cortisol peak/trough hours.
 * This is a simplified circadian model, not a medical instrument.
 */
export function buildEnergyCurve(
  chronotype: UserProfile["chronotype"],
  cortisolPeakHour: number,
  cortisolTroughHour: number
): Map<number, EnergyLevel> {
  const curve = new Map<number, EnergyLevel>();

  // Chronotype-specific offsets shift the base curve earlier/later.
  const chronotypeShift: Record<UserProfile["chronotype"], number> = {
    lion: -2, // early riser, peaks earlier
    bear: 0, // follows the sun, standard curve
    wolf: 3, // late riser, peaks later
    dolphin: -1, // light sleeper, fragmented energy, slightly early peak
  };
  const shift = chronotypeShift[chronotype];

  for (let hour = 0; hour < 24; hour++) {
    const distFromPeak = Math.min(
      Math.abs(hour - (cortisolPeakHour + shift) + 24) % 24,
      Math.abs((cortisolPeakHour + shift) - hour + 24) % 24
    );
    const distFromTrough = Math.min(
      Math.abs(hour - (cortisolTroughHour + shift) + 24) % 24,
      Math.abs((cortisolTroughHour + shift) - hour + 24) % 24
    );

    let level: EnergyLevel;
    if (distFromPeak <= 1) level = "peak";
    else if (distFromPeak <= 3) level = "high";
    else if (distFromTrough <= 1) level = "trough";
    else if (distFromTrough <= 3) level = "low";
    else level = "medium";

    // Dolphins get generally choppier energy — cap their max at "high".
    if (chronotype === "dolphin" && level === "peak") level = "high";

    curve.set(hour, level);
  }

  return curve;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function autoRescheduleDay(input: AutoRescheduleInput): RescheduleResult {
  const now = input.now ?? new Date();
  const warnings: string[] = [];

  const energyCurve = buildEnergyCurve(
    input.user.chronotype,
    input.user.cortisolPeakHour,
    input.user.cortisolTroughHour
  );

  // Build the working window for the target day.
  const [startH, startM] = input.user.workStartTime.split(":").map(Number);
  const [endH, endM] = input.user.workEndTime.split(":").map(Number);

  const dayStart = new Date(input.targetDate);
  dayStart.setHours(startH, startM, 0, 0);
  const dayEnd = new Date(input.targetDate);
  dayEnd.setHours(endH, endM, 0, 0);

  // Scheduling never starts in the past relative to "now" on today's date.
  const windowStart = now > dayStart && now < dayEnd ? now : dayStart;

  // Occupied slots start from any fixed calendar events.
  const occupied: FixedEvent[] = [...(input.fixedEvents ?? [])];

  // Rank tasks by dynamic priority score, hard deadlines effectively
  // float to the top via the urgency multiplier baked into the score.
  const rankedTasks = [...input.tasks].sort(
    (a, b) =>
      computeDynamicPriorityScore(b, now) - computeDynamicPriorityScore(a, now)
  );

  const scheduled: RescheduleResult["scheduled"] = [];
  const deferredToBacklog: string[] = [];

  for (const task of rankedTasks) {
    const durationMinutes = task.correctedMinutes ?? task.estimatedMinutes;
    const totalSpan =
      task.bufferMinutesBefore + durationMinutes + task.bufferMinutesAfter;

    const slot = findBestSlot({
      windowStart,
      windowEnd: dayEnd,
      occupied,
      totalSpanMinutes: totalSpan,
      bufferBefore: task.bufferMinutesBefore,
      bufferAfter: task.bufferMinutesAfter,
      requiredEnergy: task.requiredEnergy,
      energyCurve,
      hardDeadline: task.isHardDeadline ? task.deadlineAt : null,
    });

    if (!slot) {
      deferredToBacklog.push(task.id);
      if (task.isHardDeadline) {
        warnings.push(
          `Task ${task.id} has a hard deadline but no slot could be found today — needs manual attention.`
        );
      }
      continue;
    }

    scheduled.push({
      id: task.id,
      scheduledStart: slot.taskStart.toISOString(),
      scheduledEnd: slot.taskEnd.toISOString(),
    });

    occupied.push({ start: slot.spanStart, end: slot.spanEnd });
  }

  return { scheduled, deferredToBacklog, warnings };
}

function findBestSlot(params: {
  windowStart: Date;
  windowEnd: Date;
  occupied: FixedEvent[];
  totalSpanMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  requiredEnergy: EnergyLevel;
  energyCurve: Map<number, EnergyLevel>;
  hardDeadline: string | null;
}): { taskStart: Date; taskEnd: Date; spanStart: Date; spanEnd: Date } | null {
  const {
    windowStart,
    windowEnd,
    occupied,
    totalSpanMinutes,
    bufferBefore,
    bufferAfter,
    requiredEnergy,
    energyCurve,
    hardDeadline,
  } = params;

  const effectiveEnd = hardDeadline
    ? new Date(Math.min(new Date(hardDeadline).getTime(), windowEnd.getTime()))
    : windowEnd;

  const STEP_MINUTES = 15;
  let candidates: Array<{
    taskStart: Date;
    taskEnd: Date;
    spanStart: Date;
    spanEnd: Date;
    energyMatchScore: number;
  }> = [];

  for (
    let cursor = new Date(windowStart);
    cursor.getTime() + totalSpanMinutes * 60000 <= effectiveEnd.getTime();
    cursor = new Date(cursor.getTime() + STEP_MINUTES * 60000)
  ) {
    const spanStart = new Date(cursor);
    const spanEnd = new Date(cursor.getTime() + totalSpanMinutes * 60000);

    const collides = occupied.some((event) =>
      overlaps(spanStart, spanEnd, event.start, event.end)
    );
    if (collides) continue;

    const taskStart = new Date(spanStart.getTime() + bufferBefore * 60000);
    const taskEnd = new Date(spanEnd.getTime() - bufferAfter * 60000);

    const slotEnergy = energyCurve.get(taskStart.getHours()) ?? "medium";
    const energyMatchScore =
      ENERGY_RANK[slotEnergy] - ENERGY_RANK[requiredEnergy]; // >=0 means slot meets/exceeds requirement

    candidates.push({ taskStart, taskEnd, spanStart, spanEnd, energyMatchScore });
  }

  if (candidates.length === 0) return null;

  // Prefer the earliest slot whose energy meets the requirement;
  // fall back to the best available match if none meet it exactly.
  const meetsRequirement = candidates.filter((c) => c.energyMatchScore >= 0);
  const pool = meetsRequirement.length > 0 ? meetsRequirement : candidates;

  pool.sort((a, b) => {
    // Best energy match first, then earliest start time.
    if (b.energyMatchScore !== a.energyMatchScore) {
      return b.energyMatchScore - a.energyMatchScore;
    }
    return a.taskStart.getTime() - b.taskStart.getTime();
  });

  const best = pool[0];
  return {
    taskStart: best.taskStart,
    taskEnd: best.taskEnd,
    spanStart: best.spanStart,
    spanEnd: best.spanEnd,
  };
}
