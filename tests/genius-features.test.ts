import { describe, it, expect } from "vitest";
import { deriveTaskDnaInsight, type SimilarTaskMatch } from "../lib/dna/taskDna";
import { computeLifeScore } from "../lib/life/computeLifeScore";
import { runGoalPremortem } from "../lib/scheduling/goalPremortem";

describe("deriveTaskDnaInsight", () => {
  it("reports insufficient data with fewer than 2 close matches", () => {
    const result = deriveTaskDnaInsight([]);
    expect(result.hasEnoughData).toBe(false);
    expect(result.suggestedMinutes).toBeNull();
  });

  it("ignores matches below the similarity threshold", () => {
    const matches: SimilarTaskMatch[] = [
      { id: "1", title: "Vaguely related", estimatedMinutes: 30, actualMinutes: 30, requiredEnergy: "medium", similarity: 0.4 },
      { id: "2", title: "Also loose", estimatedMinutes: 30, actualMinutes: 30, requiredEnergy: "medium", similarity: 0.5 },
    ];
    const result = deriveTaskDnaInsight(matches);
    expect(result.hasEnoughData).toBe(false);
  });

  it("derives a weighted overrun-aware suggestion from close matches", () => {
    const matches: SimilarTaskMatch[] = [
      { id: "1", title: "Write quarterly report", estimatedMinutes: 60, actualMinutes: 100, requiredEnergy: "high", similarity: 0.95 },
      { id: "2", title: "Write annual report", estimatedMinutes: 60, actualMinutes: 90, requiredEnergy: "high", similarity: 0.85 },
      { id: "3", title: "Write monthly report", estimatedMinutes: 45, actualMinutes: 80, requiredEnergy: "high", similarity: 0.8 },
    ];
    const result = deriveTaskDnaInsight(matches);
    expect(result.hasEnoughData).toBe(true);
    expect(result.suggestedMinutes).toBeGreaterThan(60); // reflects the consistent overrun
    expect(result.averageOverrunRatio).toBeGreaterThan(1.2);
    expect(result.observedEnergy).toBe("high");
    expect(result.topMatches.length).toBeLessThanOrEqual(3);
  });
});

describe("computeLifeScore", () => {
  it("scores near-perfect inputs highly with no previous score", () => {
    const result = computeLifeScore({
      mentalBatteryPercent: 95,
      burnoutRiskScore: 5,
      habitCompletionRate7d: 1,
      hoursSinceLastCheckIn: 1,
      currentStreakDays: 30,
    });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.band).toBe("thriving");
    expect(result.trend).toBe("steady"); // no previous score given
  });

  it("applies a neglect penalty for long inactivity even with good raw signals", () => {
    const active = computeLifeScore({
      mentalBatteryPercent: 80,
      burnoutRiskScore: 10,
      habitCompletionRate7d: 0.8,
      hoursSinceLastCheckIn: 1,
      currentStreakDays: 5,
    });
    const neglected = computeLifeScore({
      mentalBatteryPercent: 80,
      burnoutRiskScore: 10,
      habitCompletionRate7d: 0.8,
      hoursSinceLastCheckIn: 30,
      currentStreakDays: 5,
    });
    expect(neglected.score).toBeLessThan(active.score);
  });

  it("detects a rising trend against the previous score", () => {
    const result = computeLifeScore(
      {
        mentalBatteryPercent: 90,
        burnoutRiskScore: 5,
        habitCompletionRate7d: 0.9,
        hoursSinceLastCheckIn: 1,
        currentStreakDays: 10,
      },
      50
    );
    expect(result.trend).toBe("rising");
  });

  it("never exceeds the 0-100 bounds even with extreme inputs", () => {
    const result = computeLifeScore({
      mentalBatteryPercent: 999,
      burnoutRiskScore: -50,
      habitCompletionRate7d: 5,
      hoursSinceLastCheckIn: 0,
      currentStreakDays: 9999,
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("runGoalPremortem", () => {
  it("reports high confidence when there's ample runway and low variance", () => {
    const result = runGoalPremortem({
      subtasks: [{ estimatedMinutes: 60 }, { estimatedMinutes: 60 }],
      targetDate: new Date("2026-10-01T00:00:00Z"),
      now: new Date("2026-09-01T00:00:00Z"), // 30 days available for ~2h of work
      dailyCapacityMinutes: 240,
      meanCorrectionFactor: 1.1,
      correctionFactorStdDev: 0.1,
      interruptionRate: 0.1,
      simulations: 300,
    });
    expect(result.probabilityOnTime).toBeGreaterThan(0.8);
    expect(result.recommendation).toBe("confident");
  });

  it("reports low confidence when the deadline is very tight relative to workload", () => {
    const result = runGoalPremortem({
      subtasks: Array.from({ length: 20 }, () => ({ estimatedMinutes: 240 })), // 80 hours of work
      targetDate: new Date("2026-09-03T00:00:00Z"),
      now: new Date("2026-09-01T00:00:00Z"), // only 2 days available
      dailyCapacityMinutes: 240,
      meanCorrectionFactor: 1.3,
      correctionFactorStdDev: 0.4,
      interruptionRate: 0.3,
      simulations: 300,
    });
    expect(result.probabilityOnTime).toBeLessThan(0.3);
    expect(["risky", "unrealistic"]).toContain(result.recommendation);
  });

  it("returns a valid ISO date range where p10 <= median <= p90", () => {
    const result = runGoalPremortem({
      subtasks: [{ estimatedMinutes: 120 }, { estimatedMinutes: 180 }],
      targetDate: new Date("2026-09-20T00:00:00Z"),
      now: new Date("2026-09-01T00:00:00Z"),
      dailyCapacityMinutes: 180,
      meanCorrectionFactor: 1.2,
      correctionFactorStdDev: 0.25,
      interruptionRate: 0.2,
      simulations: 300,
    });
    expect(new Date(result.p10CompletionDate).getTime()).toBeLessThanOrEqual(
      new Date(result.medianCompletionDate).getTime()
    );
    expect(new Date(result.medianCompletionDate).getTime()).toBeLessThanOrEqual(
      new Date(result.p90CompletionDate).getTime()
    );
  });
});
