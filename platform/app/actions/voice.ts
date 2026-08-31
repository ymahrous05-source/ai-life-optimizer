"use server";

// =====================================================================
// app/actions/voice.ts
// Wires parseVoiceTranscriptToTask() (Gemini) to a real DB insert.
// Pass this as the onTranscriptReady callback into <VoiceCapture />.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { parseVoiceTranscriptToTask } from "../../lib/ai/parseVoiceTranscriptToTask";

export interface CreateTaskFromVoiceResult {
  taskId: string;
  title: string;
  confidence: number;
}

export async function createTaskFromVoice(
  transcript: string
): Promise<CreateTaskFromVoiceResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const todayIso = new Date().toISOString().slice(0, 10);
  const parsed = await parseVoiceTranscriptToTask(transcript, todayIso);

  // Low-confidence parses still get created (as backlog, unscheduled)
  // rather than silently dropped — the user spoke it for a reason.
  let scheduledStart: string | null = null;
  if (parsed.suggestedDate) {
    const hour =
      parsed.suggestedTimeOfDay === "morning"
        ? 9
        : parsed.suggestedTimeOfDay === "afternoon"
        ? 14
        : parsed.suggestedTimeOfDay === "evening"
        ? 18
        : 9;
    const d = new Date(parsed.suggestedDate);
    d.setHours(hour, 0, 0, 0);
    scheduledStart = d.toISOString();
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: parsed.title,
      estimated_minutes: parsed.estimatedMinutes,
      required_energy: parsed.requiredEnergy,
      eisenhower_quadrant: parsed.eisenhowerQuadrant,
      abcde: parsed.abcde,
      moscow: parsed.moscow,
      status: scheduledStart ? "scheduled" : "backlog",
      scheduled_start: scheduledStart,
    })
    .select("id, title")
    .single();

  if (error || !task) throw error ?? new Error("Failed to create task from voice note");

  return { taskId: task.id, title: task.title, confidence: parsed.confidence };
}
