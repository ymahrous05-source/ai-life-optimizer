// =====================================================================
// generateDailyReflectionSummary()
// Feeds the day's task/focus/habit data into Gemini to produce a short,
// specific end-of-day retrospective — plus 2-3 targeted follow-up
// questions for the user, acting as the AI Daily Reflection Coach.
// =====================================================================
import { generateStructuredJson } from "./geminiClient";

export interface DailyReflectionInput {
  date: string; // ISO date
  tasksCompleted: number;
  tasksMissed: number;
  totalFocusMinutes: number;
  interruptedSessions: number;
  burnoutRiskScore: number;
  habitsCompleted: string[];
  habitsMissed: string[];
  financialCostOfDelay: number;
}

export interface DailyReflectionOutput {
  summary: string; // 2-4 sentence retrospective, specific to the day's data
  followUpQuestions: string[]; // 2-3 open questions for the user to answer
  suggestedFocusForTomorrow: string;
}

const SYSTEM_INSTRUCTION = `
You are an evening reflection coach inside a productivity app. Given a
structured summary of the user's day, write a short, honest, encouraging
retrospective — never generic, always grounded in the specific numbers
given. Avoid clichés like "great job today!" unless the data truly
supports it; if the day was rough, say so plainly and constructively.

Return ONLY a JSON object:
{
  "summary": string (2-4 sentences, references specific numbers from the input),
  "followUpQuestions": string[] (2-3 short, specific reflective questions),
  "suggestedFocusForTomorrow": string (one sentence)
}
`.trim();

export async function generateDailyReflectionSummary(
  input: DailyReflectionInput
): Promise<DailyReflectionOutput> {
  const userPrompt = `
Date: ${input.date}
Tasks completed: ${input.tasksCompleted}
Tasks missed: ${input.tasksMissed}
Total focused work: ${input.totalFocusMinutes} minutes
Interrupted deep-work sessions: ${input.interruptedSessions}
Burnout risk score (0-100): ${input.burnoutRiskScore}
Habits completed: ${input.habitsCompleted.join(", ") || "none"}
Habits missed: ${input.habitsMissed.join(", ") || "none"}
Financial cost of delay today: $${input.financialCostOfDelay.toFixed(2)}
`.trim();

  return generateStructuredJson<DailyReflectionOutput>({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    temperature: 0.6,
  });
}
