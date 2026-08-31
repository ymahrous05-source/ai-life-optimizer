import { describe, it, expect } from "vitest";
import { reverseTimeBlock } from "../lib/scheduling/reverseTimeBlock";
import {
  computeUpdatedStreak,
  getHabitPromptsForCompletedTask,
  getHabitsAtRiskToday,
} from "../lib/habits/habitStacking";

describe("reverseTimeBlock", () => {
  it("places the last subtask closest to the deadline", () => {
    const targetDate = new Date("2026-09-15T00:00:00");
    const result = reverseTimeBlock({
      targetDate,
      now: new Date("2026-09-01T00:00:00"),
      subtasks: [
        { id: "1", title: "Research", estimatedMinutes: 120, orderIndex: 0 },
        { id: "2", title: "Draft", estimatedMinutes: 180, orderIndex: 1 },
        { id: "3", title: "Final review", estimatedMinutes: 60, orderIndex: 2 },
      ],
      dailyCapacityMinutes: 240,
      workStartHour: 9,
      skipWeekends: false,
    });

    const lastTaskPlacement = result.placements.find((p) => p.id === "3");
    const firstTaskPlacement = result.placements.find((p) => p.id === "1");
    expect(new Date(lastTaskPlacement!.scheduledStart).getTime()).toBeGreaterThan(
      new Date(firstTaskPlacement!.scheduledStart).getTime()
    );
  });

  it("flags infeasible plans when there isn't enough runway before the deadline", () => {
    const targetDate = new Date("2026-09-03T00:00:00"); // only ~2 days away
    const result = reverseTimeBlock({
      targetDate,
      now: new Date("2026-09-01T00:00:00"),
      subtasks: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        title: `Task ${i}`,
        estimatedMinutes: 240,
        orderIndex: i,
      })), // 10 full days of work crammed into 2 days
      dailyCapacityMinutes: 240,
      workStartHour: 9,
      skipWeekends: false,
    });

    expect(result.feasible).toBe(false);
  });

  it("returns placements in forward chronological execution order", () => {
    const targetDate = new Date("2026-09-10T00:00:00");
    const result = reverseTimeBlock({
      targetDate,
      now: new Date("2026-09-01T00:00:00"),
      subtasks: [
        { id: "a", title: "A", estimatedMinutes: 60, orderIndex: 0 },
        { id: "b", title: "B", estimatedMinutes: 60, orderIndex: 1 },
      ],
      dailyCapacityMinutes: 240,
      workStartHour: 9,
      skipWeekends: false,
    });

    expect(result.placements[0].id).toBe("a");
    expect(result.placements[1].id).toBe("b");
  });
});

describe("habit stacking", () => {
  it("surfaces a prompt only for habits stacked on the completed task", () => {
    const prompts = getHabitPromptsForCompletedTask("task-1", "Morning standup", [
      {
        id: "h1",
        title: "Drink water",
        triggerTaskId: "task-1",
        durationMinutes: 1,
        currentStreak: 3,
        longestStreak: 5,
        isActive: true,
      },
      {
        id: "h2",
        title: "Unrelated habit",
        triggerTaskId: "task-99",
        durationMinutes: 2,
        currentStreak: 0,
        longestStreak: 0,
        isActive: true,
      },
    ]);

    expect(prompts).toHaveLength(1);
    expect(prompts[0].habitId).toBe("h1");
    expect(prompts[0].stackPhrase).toContain("Morning standup");
  });

  it("increments the streak for a consecutive-day completion", () => {
    const result = computeUpdatedStreak(
      { currentStreak: 4, longestStreak: 4 },
      "2026-08-30",
      "2026-08-31"
    );
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(5);
  });

  it("resets the streak to 1 after a gap of more than one day", () => {
    const result = computeUpdatedStreak(
      { currentStreak: 10, longestStreak: 10 },
      "2026-08-20",
      "2026-08-31"
    );
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10); // longest is preserved
  });

  it("identifies habits at risk of breaking their streak today", () => {
    const atRisk = getHabitsAtRiskToday(
      [
        { id: "h1", title: "A", triggerTaskId: null, durationMinutes: 5, currentStreak: 3, longestStreak: 3, isActive: true },
        { id: "h2", title: "B", triggerTaskId: null, durationMinutes: 5, currentStreak: 0, longestStreak: 3, isActive: true },
      ],
      [],
      "2026-08-31"
    );
    expect(atRisk.map((h) => h.id)).toEqual(["h1"]); // h2 has streak 0, nothing to lose
  });
});
