// =====================================================================
// computeWeeklyPerformanceReport()
//
// Turns a week of raw energy_logs + focus_sessions + completed tasks
// into the single artifact users actually want: "when am I actually
// good, and is this week better or worse than last week?"
//
// Core output is the *best energy window* — e.g. "10:00–13:00" — found
// by averaging every energy_logs sample into its hour-of-day bucket
// (peak=4 ... trough=0) across the whole week, then sliding a 3-hour
// window across the 24 buckets and keeping the one with the highest
// average score. A window (not a single hour) is used because a lone
// high-scoring hour with sparse data is noise; the best sustained
// stretch is what's actually schedulable.
// =====================================================================
import type { EnergyLevel } from "../types";

export interface EnergyLogSample {
  loggedAt: string; // ISO timestamp
  energyLevel: EnergyLevel;
}

export interface FocusSessionSample {
  startedAt: string; // ISO timestamp
  plannedMinutes: number;
  endedAt: string | null;
  wasInterrupted: boolean;
}

export interface CompletedTaskSample {
  completedAt: string; // ISO timestamp (updated_at when status -> completed)
}

export interface WeeklyPerformanceReportInput {
  energyLogs: EnergyLogSample[];
  focusSessions: FocusSessionSample[];
  completedTasks: CompletedTaskSample[];
  // Same three arrays for the 7 days immediately prior, used only to
  // compute week-over-week trend deltas. Optional — if omitted, trend
  // fields report "steady" rather than guessing.
  previousWeek?: {
    focusSessions: FocusSessionSample[];
    completedTasks: CompletedTaskSample[];
  };
}

export interface HourlyEnergyBucket {
  hour: number; // 0-23, local time
  averageScore: number; // 0-4 (trough..peak), NaN-safe: 0 samples -> 0
  sampleCount: number;
}

export interface WeeklyPerformanceReport {
  /** Human-readable headline, e.g. "Your energy is best between 10 AM and 1 PM." */
  headline: string;
  bestEnergyWindow: { startHour: number; endHour: number } | null;
  hourlyBreakdown: HourlyEnergyBucket[];
  totalFocusedMinutes: number;
  completedFocusSessions: number;
  interruptedFocusSessions: number;
  focusCompletionRate: number; // 0-1
  tasksCompleted: number;
  focusedMinutesTrend: "up" | "down" | "flat";
  tasksCompletedTrend: "up" | "down" | "flat";
  hasEnoughData: boolean; // fewer than MIN_SAMPLES energy logs -> window is unreliable
}

const ENERGY_SCORE: Record<EnergyLevel, number> = {
  trough: 0,
  low: 1,
  medium: 2,
  high: 3,
  peak: 4,
};

const WINDOW_HOURS = 3;
const MIN_SAMPLES_FOR_CONFIDENCE = 5;
const TREND_FLAT_THRESHOLD = 0.1; // ±10% counts as "flat" rather than up/down

export function computeWeeklyPerformanceReport(
  input: WeeklyPerformanceReportInput
): WeeklyPerformanceReport {
  const hourlyBreakdown = buildHourlyBreakdown(input.energyLogs);
  const totalSamples = input.energyLogs.length;
  const hasEnoughData = totalSamples >= MIN_SAMPLES_FOR_CONFIDENCE;

  const bestEnergyWindow = hasEnoughData ? findBestWindow(hourlyBreakdown) : null;

  const completedFocusSessions = input.focusSessions.filter((s) => s.endedAt !== null).length;
  const interruptedFocusSessions = input.focusSessions.filter((s) => s.wasInterrupted).length;
  const totalFocusedMinutes = input.focusSessions
    .filter((s) => s.endedAt !== null && !s.wasInterrupted)
    .reduce((sum, s) => sum + s.plannedMinutes, 0);
  const focusCompletionRate =
    input.focusSessions.length > 0 ? completedFocusSessions / input.focusSessions.length : 0;

  const tasksCompleted = input.completedTasks.length;

  const previousFocusedMinutes = (input.previousWeek?.focusSessions ?? [])
    .filter((s) => s.endedAt !== null && !s.wasInterrupted)
    .reduce((sum, s) => sum + s.plannedMinutes, 0);
  const previousTasksCompleted = input.previousWeek?.completedTasks.length ?? 0;

  const focusedMinutesTrend = trendDirection(totalFocusedMinutes, previousFocusedMinutes);
  const tasksCompletedTrend = trendDirection(tasksCompleted, previousTasksCompleted);

  const headline = buildHeadline(bestEnergyWindow, hasEnoughData);

  return {
    headline,
    bestEnergyWindow,
    hourlyBreakdown,
    totalFocusedMinutes,
    completedFocusSessions,
    interruptedFocusSessions,
    focusCompletionRate,
    tasksCompleted,
    focusedMinutesTrend,
    tasksCompletedTrend,
    hasEnoughData,
  };
}

function buildHourlyBreakdown(logs: EnergyLogSample[]): HourlyEnergyBucket[] {
  const sums = new Array(24).fill(0);
  const counts = new Array(24).fill(0);

  for (const log of logs) {
    const hour = new Date(log.loggedAt).getHours();
    sums[hour] += ENERGY_SCORE[log.energyLevel];
    counts[hour] += 1;
  }

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    averageScore: counts[hour] > 0 ? sums[hour] / counts[hour] : 0,
    sampleCount: counts[hour],
  }));
}

/**
 * Slides a WINDOW_HOURS-wide window across the 24 hourly buckets and
 * returns the start/end of the window with the highest total score,
 * counting only hours that actually have samples (an empty hour
 * contributes 0 rather than dragging the average down with fake data —
 * but a window made entirely of empty hours is skipped).
 */
function findBestWindow(
  buckets: HourlyEnergyBucket[]
): { startHour: number; endHour: number } | null {
  let bestStart = -1;
  let bestScore = -Infinity;

  for (let start = 0; start <= 24 - WINDOW_HOURS; start++) {
    const slice = buckets.slice(start, start + WINDOW_HOURS);
    const samplesInWindow = slice.reduce((sum, b) => sum + b.sampleCount, 0);
    if (samplesInWindow === 0) continue;

    const score = slice.reduce((sum, b) => sum + b.averageScore, 0);
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  if (bestStart === -1) return null;
  return { startHour: bestStart, endHour: bestStart + WINDOW_HOURS };
}

function trendDirection(current: number, previous: number): "up" | "down" | "flat" {
  if (previous === 0) return current > 0 ? "up" : "flat";
  const change = (current - previous) / previous;
  if (change > TREND_FLAT_THRESHOLD) return "up";
  if (change < -TREND_FLAT_THRESHOLD) return "down";
  return "flat";
}

function buildHeadline(
  window: { startHour: number; endHour: number } | null,
  hasEnoughData: boolean
): string {
  if (!hasEnoughData || !window) {
    return "Log a few more energy check-ins this week to unlock your best-focus window.";
  }
  return `Your energy is best between ${formatHour(window.startHour)} and ${formatHour(
    window.endHour
  )}.`;
}

function formatHour(hour24: number): string {
  const h = hour24 % 24;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}
