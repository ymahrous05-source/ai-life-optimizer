import { describe, it, expect } from "vitest";
import {
  computePlanningCorrectionFactor,
  calculateBurnoutAndCorrection,
} from "../lib/ai/calculateBurnoutAndCorrection";

describe("computePlanningCorrectionFactor", () => {
  it("returns the previous factor when there is no history", () => {
    expect(computePlanningCorrectionFactor([], 1.2)).toBe(1.2);
  });

  it("learns toward the true ratio when the user consistently underestimates", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      estimatedMinutes: 30,
      actualMinutes: 45, // consistently 1.5x
      completedAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    const factor = computePlanningCorrectionFactor(history, 1.0);
    expect(factor).toBeGreaterThan(1.2);
    expect(factor).toBeLessThanOrEqual(1.6);
  });

  it("clamps extreme outlier ratios so one bad sample cannot dominate", () => {
    const history = [
      { estimatedMinutes: 10, actualMinutes: 1000, completedAt: "2026-01-01T00:00:00Z" },
    ];
    const factor = computePlanningCorrectionFactor(history, 1.0);
    expect(factor).toBeLessThanOrEqual(3);
  });

  it("stays within the sane band (0.7x - 3x)", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      estimatedMinutes: 10,
      actualMinutes: 1,
      completedAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    const factor = computePlanningCorrectionFactor(history, 1.0);
    expect(factor).toBeGreaterThanOrEqual(0.7);
  });
});

describe("calculateBurnoutAndCorrection", () => {
  it("reports low risk with no interruptions, stable load, and a recent break", () => {
    const result = calculateBurnoutAndCorrection({
      taskHistory: [],
      recentFocusSessions: [
        {
          plannedMinutes: 25,
          wasInterrupted: false,
          sessionType: "deep_work",
          startedAt: new Date().toISOString(),
        },
        {
          plannedMinutes: 15,
          wasInterrupted: false,
          sessionType: "nsdr",
          startedAt: new Date().toISOString(),
        },
      ],
      recentEnergyLogs: [
        { loggedAt: new Date(Date.now() - 3600_000).toISOString(), cognitiveLoadRemaining: 80 },
        { loggedAt: new Date().toISOString(), cognitiveLoadRemaining: 82 },
      ],
      previousCorrectionFactor: 1.0,
    });

    expect(result.burnoutRiskScore).toBeLessThan(30);
    expect(result.recommendedAction).toBe("none");
  });

  it("recommends stopping for the day under high interruption + no recent break + draining load", () => {
    const oldBreak = new Date(Date.now() - 30 * 3600_000).toISOString(); // 30h ago
    const result = calculateBurnoutAndCorrection({
      taskHistory: [],
      recentFocusSessions: [
        { plannedMinutes: 25, wasInterrupted: true, sessionType: "deep_work", startedAt: new Date().toISOString() },
        { plannedMinutes: 25, wasInterrupted: true, sessionType: "lockdown", startedAt: new Date().toISOString() },
        { plannedMinutes: 25, wasInterrupted: true, sessionType: "deep_work", startedAt: new Date().toISOString() },
        { plannedMinutes: 15, wasInterrupted: false, sessionType: "nsdr", startedAt: oldBreak },
      ],
      recentEnergyLogs: [
        { loggedAt: new Date(Date.now() - 6 * 3600_000).toISOString(), cognitiveLoadRemaining: 90 },
        { loggedAt: new Date().toISOString(), cognitiveLoadRemaining: 20 },
      ],
      previousCorrectionFactor: 1.0,
    });

    expect(result.burnoutRiskScore).toBeGreaterThanOrEqual(50);
    expect(["nsdr", "stop_for_day"]).toContain(result.recommendedAction);
  });
});
