// =====================================================================
// parseVoiceTranscriptToTask()
// Takes a raw Web Speech API transcript ("remind me to draft the
// proposal for an hour tomorrow morning, it's pretty urgent") and
// converts it into structured task fields via Gemini, ready to insert
// into the `tasks` table.
// =====================================================================
import { generateStructuredJson } from "./geminiClient";
import type {
  AbcdePriority,
  EisenhowerQuadrant,
  EnergyLevel,
  MoscowPriority,
} from "../types";

export interface ParsedVoiceTask {
  title: string;
  estimatedMinutes: number;
  requiredEnergy: EnergyLevel;
  eisenhowerQuadrant: EisenhowerQuadrant;
  abcde: AbcdePriority;
  moscow: MoscowPriority;
  suggestedDate: string | null; // ISO date, null if unspecified ("today" resolved by caller)
  suggestedTimeOfDay: "morning" | "afternoon" | "evening" | null;
  confidence: number; // 0-1, model's confidence this was really a task
}

interface RawShape {
  title: string;
  estimated_minutes: number;
  required_energy: EnergyLevel;
  eisenhower_quadrant: EisenhowerQuadrant;
  abcde: AbcdePriority;
  moscow: MoscowPriority;
  suggested_date: string | null;
  suggested_time_of_day: "morning" | "afternoon" | "evening" | null;
  confidence: number;
}

const SYSTEM_INSTRUCTION = `
You convert a spoken voice-note transcript from a productivity app into
a single structured task. The user was talking casually — extract intent,
don't quote them verbatim in "title".

Rules:
- "title" is a short, clean task name (max 12 words), not a transcript copy.
- estimated_minutes: infer from context ("an hour" -> 60), default to 30 if unstated.
- required_energy: infer from the nature of the task (creative/analytical = high/peak; routine = low).
- eisenhower_quadrant, abcde, moscow: infer from urgency/importance language
  ("urgent", "whenever", "critical", "nice to have", etc). Default to
  balanced middle values if nothing is signaled.
- suggested_date: an ISO date (YYYY-MM-DD) ONLY if the user named a
  relative/absolute day ("tomorrow", "Friday"); otherwise null. Do not
  guess a specific date without a stated reference point.
- suggested_time_of_day: "morning" | "afternoon" | "evening" | null.
- confidence: 0-1, how confident you are this transcript actually
  describes an actionable task (vs. noise/unrelated speech).

Return ONLY a single JSON object matching:
{
  "title": string,
  "estimated_minutes": number,
  "required_energy": "peak"|"high"|"medium"|"low"|"trough",
  "eisenhower_quadrant": "urgent_important"|"not_urgent_important"|"urgent_not_important"|"not_urgent_not_important",
  "abcde": "A"|"B"|"C"|"D"|"E",
  "moscow": "must"|"should"|"could"|"wont",
  "suggested_date": string | null,
  "suggested_time_of_day": "morning"|"afternoon"|"evening"|null,
  "confidence": number
}
`.trim();

export async function parseVoiceTranscriptToTask(
  transcript: string,
  todayIso: string
): Promise<ParsedVoiceTask> {
  if (!transcript || transcript.trim().length < 3) {
    throw new Error("Transcript too short to parse");
  }

  const raw = await generateStructuredJson<RawShape>({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: `Today's date: ${todayIso}\nTranscript: "${transcript.trim()}"`,
    temperature: 0.3,
  });

  return {
    title: (raw.title || transcript.slice(0, 80)).slice(0, 200),
    estimatedMinutes: clamp(raw.estimated_minutes ?? 30, 5, 480),
    requiredEnergy: raw.required_energy ?? "medium",
    eisenhowerQuadrant: raw.eisenhower_quadrant ?? "not_urgent_important",
    abcde: raw.abcde ?? "C",
    moscow: raw.moscow ?? "should",
    suggestedDate: raw.suggested_date ?? null,
    suggestedTimeOfDay: raw.suggested_time_of_day ?? null,
    confidence: clamp(raw.confidence ?? 0.5, 0, 1),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
