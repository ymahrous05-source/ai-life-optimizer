// =====================================================================
// decomposeGoalWithGemini()
// Breaks a high-level goal into concrete sub-tasks with time/energy/
// priority metadata, using Gemini's free-tier API with forced JSON output.
// =====================================================================
import { generateStructuredJson } from "./geminiClient";
import type { DecomposedSubtask } from "../types";

interface DecomposeGoalInput {
  goalTitle: string;
  goalDescription?: string;
  targetDate?: string; // ISO date — used for reverse time-blocking hints
  userContext?: {
    chronotype: string;
    hourlyRate: number;
    workHoursPerDay: number;
  };
}

interface GeminiSubtaskShape {
  title: string;
  description: string;
  estimated_minutes: number;
  required_energy: "peak" | "high" | "medium" | "low" | "trough";
  eisenhower_quadrant:
    | "urgent_important"
    | "not_urgent_important"
    | "urgent_not_important"
    | "not_urgent_not_important";
  moscow: "must" | "should" | "could" | "wont";
}

const SYSTEM_INSTRUCTION = `
You are a productivity planning engine embedded in a time-management app.
Given a user's goal, decompose it into 4–12 concrete, actionable sub-tasks.

Rules:
- Each sub-task must be independently actionable (a single work session).
- estimated_minutes must be realistic (15–240), in 15-minute increments.
- required_energy should reflect how mentally demanding the sub-task is
  (deep creative/analytical work = "peak" or "high"; routine/admin = "low").
- eisenhower_quadrant and moscow must be assigned thoughtfully based on
  how critical the sub-task is to achieving the goal, and its urgency
  relative to any target date provided.
- Order sub-tasks in a logical execution sequence.

Return ONLY a JSON array of objects, each shaped exactly as:
{
  "title": string,
  "description": string,
  "estimated_minutes": number,
  "required_energy": "peak" | "high" | "medium" | "low" | "trough",
  "eisenhower_quadrant": "urgent_important" | "not_urgent_important" | "urgent_not_important" | "not_urgent_not_important",
  "moscow": "must" | "should" | "could" | "wont"
}
`.trim();

export async function decomposeGoalWithGemini(
  input: DecomposeGoalInput
): Promise<DecomposedSubtask[]> {
  const userPrompt = `
Goal: ${input.goalTitle}
Description: ${input.goalDescription ?? "(none provided)"}
Target date: ${input.targetDate ?? "(no hard deadline)"}
User chronotype: ${input.userContext?.chronotype ?? "unknown"}
User hourly rate: $${input.userContext?.hourlyRate ?? 0}
Available work hours/day: ${input.userContext?.workHoursPerDay ?? 8}

Decompose this goal now.
`.trim();

  const raw = await generateStructuredJson<GeminiSubtaskShape[]>({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    temperature: 0.5,
  });

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Gemini did not return a valid sub-task array");
  }

  // Defensive normalization — never trust the model's output blindly.
  return raw.map((item, index): DecomposedSubtask => ({
    title: String(item.title ?? `Untitled sub-task ${index + 1}`).slice(0, 200),
    description: String(item.description ?? "").slice(0, 2000),
    estimatedMinutes: clampMinutes(item.estimated_minutes),
    requiredEnergy: isValidEnergy(item.required_energy)
      ? item.required_energy
      : "medium",
    eisenhowerQuadrant: isValidQuadrant(item.eisenhower_quadrant)
      ? item.eisenhower_quadrant
      : "not_urgent_important",
    moscow: isValidMoscow(item.moscow) ? item.moscow : "should",
    orderIndex: index,
  }));
}

function clampMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return 30;
  const rounded = Math.round(n / 15) * 15;
  return Math.min(240, Math.max(15, rounded));
}

function isValidEnergy(v: unknown): v is DecomposedSubtask["requiredEnergy"] {
  return ["peak", "high", "medium", "low", "trough"].includes(v as string);
}

function isValidQuadrant(
  v: unknown
): v is DecomposedSubtask["eisenhowerQuadrant"] {
  return [
    "urgent_important",
    "not_urgent_important",
    "urgent_not_important",
    "not_urgent_not_important",
  ].includes(v as string);
}

function isValidMoscow(v: unknown): v is DecomposedSubtask["moscow"] {
  return ["must", "should", "could", "wont"].includes(v as string);
}
