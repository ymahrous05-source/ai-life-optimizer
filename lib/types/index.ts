// =====================================================================
// Shared domain types — mirror the Postgres enums/tables in 001_schema.sql
// =====================================================================

export type Chronotype = "lion" | "bear" | "wolf" | "dolphin";

export type EnergyLevel = "peak" | "high" | "medium" | "low" | "trough";

export type EisenhowerQuadrant =
  | "urgent_important"
  | "not_urgent_important"
  | "urgent_not_important"
  | "not_urgent_not_important";

export type AbcdePriority = "A" | "B" | "C" | "D" | "E";
export type MoscowPriority = "must" | "should" | "could" | "wont";

export type TaskStatus =
  | "backlog"
  | "scheduled"
  | "in_progress"
  | "blocked"
  | "completed"
  | "missed"
  | "cancelled";

export interface UserProfile {
  id: string;
  fullName: string | null;
  timezone: string;
  chronotype: Chronotype;
  hourlyRate: number;
  cortisolPeakHour: number; // 0-23
  cortisolTroughHour: number; // 0-23
  workStartTime: string; // "09:00"
  workEndTime: string; // "18:00"
  planningCorrectionFactor: number; // e.g. 1.35 = user underestimates by 35%
  cognitiveLoadMax: number; // Mental Battery capacity, default 100
}

export interface Task {
  id: string;
  userId: string;
  projectId: string | null;
  goalId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;

  eisenhowerQuadrant: EisenhowerQuadrant | null;
  abcde: AbcdePriority | null;
  moscow: MoscowPriority | null;

  codValue: number; // $ lost per hour of delay
  codUrgencyProfile: "linear" | "fixed_date" | "expedite" | "intangible";
  dynamicPriorityScore: number;

  estimatedMinutes: number;
  correctedMinutes: number | null;
  actualMinutes: number | null;

  requiredEnergy: EnergyLevel;
  cognitiveLoadCost: number;

  scheduledStart: string | null; // ISO timestamp
  scheduledEnd: string | null;
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;

  status: TaskStatus;
  isHardDeadline: boolean;
  deadlineAt: string | null;
}

export interface EnergyLogPoint {
  hour: number; // 0-23
  level: EnergyLevel;
}

export interface RescheduleResult {
  scheduled: Array<Pick<Task, "id" | "scheduledStart" | "scheduledEnd">>;
  deferredToBacklog: string[]; // task IDs that didn't fit today
  warnings: string[];
}

export interface DecomposedSubtask {
  title: string;
  description: string;
  estimatedMinutes: number;
  requiredEnergy: EnergyLevel;
  eisenhowerQuadrant: EisenhowerQuadrant;
  moscow: MoscowPriority;
  orderIndex: number;
}

export interface BurnoutAssessment {
  burnoutRiskScore: number; // 0-100
  recommendedAction: "none" | "micro_break" | "nsdr" | "stop_for_day";
  updatedCorrectionFactor: number;
  rationale: string;
}
