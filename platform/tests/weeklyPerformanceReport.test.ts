import { describe, it, expect } from "vitest";
import { computeWeeklyPerformanceReport } from "../lib/reports/weeklyPerformanceReport";

function isoAtHour(day: number, hour: number): string {
  return new Date(2026, 0, day, hour, 0, 0).toISOString();
}

describe("computeWeeklyPerformanceReport", () => {
  it("finds the sustained high-energy window, not a single noisy spike", () => {
    const energyLogs = [];
    // Peak energy 10am-1pm across 5 days
    for (let day = 1; day <= 5; day++) {
      energyLogs.push({ loggedAt: isoAtHour(day, 10), energyLevel: "peak" as const });
      energyLogs.push({ loggedAt: isoAtHour(day, 11), energyLevel: "peak" as const });
      energyLogs.push({ loggedAt: isoAtHour(day, 12), energyLevel: "high" as const });
      // A single lonely "peak" reading at 4am shouldn't win over the sustained block
      energyLogs.push({ loggedAt: isoAtHour(day, 4), energyLevel: "low" as const });
    }

    const report = computeWeeklyPerformanceReport({
      energyLogs,
      focusSessions: [],
      completedTasks: [],
    });

    expect(report.hasEnoughData).toBe(true);
    expect(report.bestEnergyWindow).toEqual({ startHour: 10, endHour: 13 });
    expect(report.headline).toContain("10 AM");
    expect(report.headline).toContain("1 PM");
  });

  it("reports not-enough-data rather than guessing when logs are sparse", () => {
    const report = computeWeeklyPerformanceReport({
      energyLogs: [{ loggedAt: isoAtHour(1, 10), energyLevel: "peak" }],
      focusSessions: [],
      completedTasks: [],
    });

    expect(report.hasEnoughData).toBe(false);
    expect(report.bestEnergyWindow).toBeNull();
  });

  it("sums only completed, uninterrupted sessions toward focused minutes", () => {
    const report = computeWeeklyPerformanceReport({
      energyLogs: [],
      focusSessions: [
        { startedAt: isoAtHour(1, 9), plannedMinutes: 25, endedAt: isoAtHour(1, 9), wasInterrupted: false },
        { startedAt: isoAtHour(1, 10), plannedMinutes: 25, endedAt: isoAtHour(1, 10), wasInterrupted: true },
        { startedAt: isoAtHour(1, 11), plannedMinutes: 25, endedAt: null, wasInterrupted: false },
      ],
      completedTasks: [],
    });

    expect(report.totalFocusedMinutes).toBe(25);
    expect(report.completedFocusSessions).toBe(2);
    expect(report.interruptedFocusSessions).toBe(1);
  });

  it("flags an upward trend when this week beats last week by more than the flat threshold", () => {
    const report = computeWeeklyPerformanceReport({
      energyLogs: [],
      focusSessions: [
        { startedAt: isoAtHour(1, 9), plannedMinutes: 100, endedAt: isoAtHour(1, 9), wasInterrupted: false },
      ],
      completedTasks: [{ completedAt: isoAtHour(1, 9) }, { completedAt: isoAtHour(2, 9) }],
      previousWeek: {
        focusSessions: [
          { startedAt: isoAtHour(1, 9), plannedMinutes: 50, endedAt: isoAtHour(1, 9), wasInterrupted: false },
        ],
        completedTasks: [{ completedAt: isoAtHour(1, 9) }],
      },
    });

    expect(report.focusedMinutesTrend).toBe("up");
    expect(report.tasksCompletedTrend).toBe("up");
  });
});
