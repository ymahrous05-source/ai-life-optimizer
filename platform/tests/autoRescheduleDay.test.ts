import { describe, it, expect } from "vitest";
import {
  autoRescheduleDay,
  computeDynamicPriorityScore,
  buildEnergyCurve,
} from "../lib/ai/autoRescheduleDay";

describe("buildEnergyCurve", () => {
  it("marks the cortisol peak hour as 'peak' energy", () => {
    const curve = buildEnergyCurve("bear", 9, 15);
    expect(curve.get(9)).toBe("peak");
  });

  it("marks the cortisol trough hour as 'trough' energy", () => {
    const curve = buildEnergyCurve("bear", 9, 15);
    expect(curve.get(15)).toBe("trough");
  });

  it("caps dolphin chronotype energy at 'high' (never 'peak')", () => {
    const curve = buildEnergyCurve("dolphin", 9, 15);
    expect([...curve.values()]).not.toContain("peak");
  });
});

describe("computeDynamicPriorityScore", () => {
  const now = new Date("2026-08-31T10:00:00Z");

  it("ranks a higher cost-of-delay task above a lower one, all else equal", () => {
    const cheap = {
      id: "a",
      estimatedMinutes: 60,
      correctedMinutes: null,
      requiredEnergy: "medium" as const,
      codValue: 10,
      codUrgencyProfile: "linear" as const,
      isHardDeadline: false,
      deadlineAt: null,
      bufferMinutesBefore: 0,
      bufferMinutesAfter: 0,
    };
    const expensive = { ...cheap, id: "b", codValue: 1000 };

    expect(computeDynamicPriorityScore(expensive, now)).toBeGreaterThan(
      computeDynamicPriorityScore(cheap, now)
    );
  });

  it("boosts a task's score sharply as its hard deadline approaches", () => {
    const base = {
      id: "a",
      estimatedMinutes: 60,
      correctedMinutes: null,
      requiredEnergy: "medium" as const,
      codValue: 100,
      codUrgencyProfile: "fixed_date" as const,
      isHardDeadline: true,
      deadlineAt: "",
      bufferMinutesBefore: 0,
      bufferMinutesAfter: 0,
    };
    const farDeadline = { ...base, deadlineAt: new Date(now.getTime() + 30 * 24 * 3600_000).toISOString() };
    const nearDeadline = { ...base, deadlineAt: new Date(now.getTime() + 2 * 3600_000).toISOString() };

    expect(computeDynamicPriorityScore(nearDeadline, now)).toBeGreaterThan(
      computeDynamicPriorityScore(farDeadline, now)
    );
  });
});

describe("autoRescheduleDay", () => {
  const user = {
    chronotype: "bear" as const,
    cortisolPeakHour: 9,
    cortisolTroughHour: 15,
    workStartTime: "08:00",
    workEndTime: "18:00",
  };

  it("schedules a simple task within the work window", () => {
    const targetDate = new Date("2026-09-01T00:00:00");
    const result = autoRescheduleDay({
      user,
      targetDate,
      now: new Date("2026-09-01T07:00:00"),
      tasks: [
        {
          id: "t1",
          estimatedMinutes: 60,
          correctedMinutes: null,
          requiredEnergy: "medium",
          codValue: 50,
          codUrgencyProfile: "linear",
          isHardDeadline: false,
          deadlineAt: null,
          bufferMinutesBefore: 0,
          bufferMinutesAfter: 5,
        },
      ],
    });

    expect(result.scheduled).toHaveLength(1);
    expect(result.deferredToBacklog).toHaveLength(0);
  });

  it("defers tasks that don't fit within the working day to the backlog", () => {
    const targetDate = new Date("2026-09-01T00:00:00");
    const result = autoRescheduleDay({
      user: { ...user, workStartTime: "09:00", workEndTime: "10:00" }, // only 1 hour of capacity
      targetDate,
      now: new Date("2026-09-01T08:00:00"),
      tasks: [
        {
          id: "t1",
          estimatedMinutes: 45,
          correctedMinutes: null,
          requiredEnergy: "medium",
          codValue: 50,
          codUrgencyProfile: "linear",
          isHardDeadline: false,
          deadlineAt: null,
          bufferMinutesBefore: 0,
          bufferMinutesAfter: 0,
        },
        {
          id: "t2",
          estimatedMinutes: 45,
          correctedMinutes: null,
          requiredEnergy: "medium",
          codValue: 5, // lower priority — should be the one deferred
          codUrgencyProfile: "linear",
          isHardDeadline: false,
          deadlineAt: null,
          bufferMinutesBefore: 0,
          bufferMinutesAfter: 0,
        },
      ],
    });

    expect(result.scheduled).toHaveLength(1);
    expect(result.deferredToBacklog).toEqual(["t2"]);
  });

  it("never double-books a slot already occupied by a fixed event", () => {
    const targetDate = new Date("2026-09-01T00:00:00");
    const fixedStart = new Date("2026-09-01T09:00:00");
    const fixedEnd = new Date("2026-09-01T17:00:00");

    const result = autoRescheduleDay({
      user,
      targetDate,
      now: new Date("2026-09-01T08:00:00"),
      fixedEvents: [{ start: fixedStart, end: fixedEnd }],
      tasks: [
        {
          id: "t1",
          estimatedMinutes: 30,
          correctedMinutes: null,
          requiredEnergy: "medium",
          codValue: 50,
          codUrgencyProfile: "linear",
          isHardDeadline: false,
          deadlineAt: null,
          bufferMinutesBefore: 0,
          bufferMinutesAfter: 0,
        },
      ],
    });

    if (result.scheduled.length === 1) {
      const start = new Date(result.scheduled[0].scheduledStart!);
      const end = new Date(result.scheduled[0].scheduledEnd!);
      const overlapsFixed = start < fixedEnd && fixedStart < end;
      expect(overlapsFixed).toBe(false);
    }
  });
});
