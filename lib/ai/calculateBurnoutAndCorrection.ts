// =====================================================================
// calculateBurnoutAndCorrection()
//
// Two responsibilities, kept together because they share the same
// historical-completion dataset:
//
// 1. Planning Fallacy Estimator — learns a personalized correction
//    factor from (actual_minutes / estimated_minutes) across the
//    user's completed tasks, via an exponentially-weighted moving
//    average (recent behavior weighted more heavily than old).
//
// 2. Burnout & Relapse Prediction — scores current fatigue risk from
//    recent focus-session interruption rate, cognitive load trend,
//    and consecutive missed-break streaks, then recommends an action.
// =====================================================================
import type { BurnoutAssessment } from "../types";

export interface CompletedTaskSample {
  estimatedMinutes: number;
  actualMinutes: number;
  completedAt: string; // ISO timestamp, used for recency weighting
}

export interface FocusSessionSample {
  plannedMinutes: number;
  wasInterrupted: boolean;
  sessionType: "deep_work" | "lockdown" | "co_working" | "nsdr" | "micro_break";
  startedAt: string;
}

export interface EnergyLogSample {
  loggedAt: string;
  cognitiveLoadRemaining: number; // 0-100, % of Mental Battery left
}

const EWMA_DECAY = 0.85; // higher = more weight on recent samples
const MIN_SAMPLES_FOR_CONFIDENCE = 5;

/**
 * Planning Fallacy Estimator: personalized correction factor.
 * A factor of 1.35 means the user's tasks tend to take 35% longer
 * than they estimate; multiply future estimates by this factor.
 */
export function computePlanningCorrectionFactor(
  history: CompletedTaskSample[],
  previousFactor: number = 1.0
): number {
  if (history.length === 0) return previousFactor;

  // Sort oldest -> newest so recency weighting is applied correctly.
  const sorted = [...history].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  let weightedSum = 0;
  let weightTotal = 0;

  sorted.forEach((sample, index) => {
    if (sample.estimatedMinutes <= 0) return;
    const ratio = sample.actualMinutes / sample.estimatedMinutes;
    // Clamp extreme outliers (e.g. a task left running overnight) so a
    // single anomaly can't wreck the whole model.
    const clampedRatio = Math.min(4, Math.max(0.25, ratio));

    const recencyRank = sorted.length - 1 - index; // 0 = most recent
    const weight = Math.pow(EWMA_DECAY, recencyRank);

    weightedSum += clampedRatio * weight;
    weightTotal += weight;
  });

  if (weightTotal === 0) return previousFactor;

  const learnedFactor = weightedSum / weightTotal;

  // Low-confidence blending: with few samples, trust the prior more.
  const confidence = Math.min(1, history.length / MIN_SAMPLES_FOR_CONFIDENCE);
  const blended = previousFactor * (1 - confidence) + learnedFactor * confidence;

  // Keep the factor within a sane band (0.7x – 3x) to avoid runaway
  // schedules if the data is noisy.
  return Math.min(3, Math.max(0.7, Number(blended.toFixed(3))));
}

/**
 * Burnout & Relapse Prediction.
 * Combines three signals into a 0–100 risk score:
 *  - interruption rate across recent focus sessions
 *  - rate of cognitive-load decline (Mental Battery draining faster
 *    than it recovers)
 *  - how long it's been since the last NSDR/micro-break
 */
export function calculateBurnoutAndCorrection(input: {
  taskHistory: CompletedTaskSample[];
  recentFocusSessions: FocusSessionSample[]; // last ~48h
  recentEnergyLogs: EnergyLogSample[]; // last ~48h, chronological
  previousCorrectionFactor: number;
}): BurnoutAssessment {
  const updatedCorrectionFactor = computePlanningCorrectionFactor(
    input.taskHistory,
    input.previousCorrectionFactor
  );

  // --- Signal 1: interruption rate ---
  const deepWorkSessions = input.recentFocusSessions.filter(
    (s) => s.sessionType === "deep_work" || s.sessionType === "lockdown"
  );
  const interruptionRate =
    deepWorkSessions.length === 0
      ? 0
      : deepWorkSessions.filter((s) => s.wasInterrupted).length /
        deepWorkSessions.length;

  // --- Signal 2: cognitive load trend (is the battery recovering?) ---
  const sortedLogs = [...input.recentEnergyLogs].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );
  let loadTrendPenalty = 0;
  if (sortedLogs.length >= 2) {
    const first = sortedLogs[0].cognitiveLoadRemaining;
    const last = sortedLogs[sortedLogs.length - 1].cognitiveLoadRemaining;
    const netChange = last - first; // negative = draining over time, no recovery
    loadTrendPenalty = netChange < 0 ? Math.min(40, Math.abs(netChange) * 0.6) : 0;
  }

  // --- Signal 3: time since last recovery session (NSDR/micro-break) ---
  const lastBreak = [...input.recentFocusSessions]
    .filter((s) => s.sessionType === "nsdr" || s.sessionType === "micro_break")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

  let hoursSinceBreak = 24; // assume worst case if no break logged
  if (lastBreak) {
    hoursSinceBreak =
      (Date.now() - new Date(lastBreak.startedAt).getTime()) / (1000 * 60 * 60);
  }
  const breakPenalty = Math.min(30, Math.max(0, hoursSinceBreak - 3) * 3);

  const burnoutRiskScore = Math.min(
    100,
    Math.round(interruptionRate * 30 + loadTrendPenalty + breakPenalty)
  );

  let recommendedAction: BurnoutAssessment["recommendedAction"] = "none";
  let rationale = "Energy and focus patterns look healthy.";

  if (burnoutRiskScore >= 75) {
    recommendedAction = "stop_for_day";
    rationale =
      "High interruption rate, sustained cognitive load decline, and an extended gap since the last recovery break indicate significant burnout risk. Recommend ending deep work for today.";
  } else if (burnoutRiskScore >= 50) {
    recommendedAction = "nsdr";
    rationale =
      "Cognitive load is trending down without adequate recovery. A 10–20 minute NSDR session is recommended before the next deep-work block.";
  } else if (burnoutRiskScore >= 30) {
    recommendedAction = "micro_break";
    rationale =
      "Mild fatigue signals detected. A short micro-break is recommended before continuing.";
  }

  return {
    burnoutRiskScore,
    recommendedAction,
    updatedCorrectionFactor,
    rationale,
  };
}
