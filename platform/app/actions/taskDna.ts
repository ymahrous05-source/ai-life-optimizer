"use server";

// =====================================================================
// app/actions/taskDna.ts
// 1. embedTaskOnCompletion() — called when a task is marked complete;
//    generates and stores its embedding so future similar tasks can
//    learn from it.
// 2. getTaskDnaInsightForDraft() — called while the user is creating a
//    new task/goal; embeds the draft title and finds similar past
//    tasks via the match_similar_tasks() pgvector function.
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { embedText, buildTaskEmbeddingInput } from "../../lib/ai/embedText";
import { deriveTaskDnaInsight, type SimilarTaskMatch } from "../../lib/dna/taskDna";
import type { TaskDnaInsight } from "../../lib/dna/taskDna";

export async function embedTaskOnCompletion(taskId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, required_energy")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (!task) return;

  const embedding = await embedText(
    buildTaskEmbeddingInput({
      title: task.title,
      description: task.description,
      requiredEnergy: task.required_energy,
    })
  );

  await supabase.from("tasks").update({ embedding }).eq("id", taskId);
}

export async function getTaskDnaInsightForDraft(
  draftTitle: string,
  draftDescription?: string
): Promise<TaskDnaInsight> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const embedding = await embedText(
    buildTaskEmbeddingInput({ title: draftTitle, description: draftDescription })
  );

  const { data: matches, error } = await supabase.rpc("match_similar_tasks", {
    query_embedding: embedding,
    match_user_id: user.id,
    match_count: 5,
  });

  if (error) {
    // Fail soft — Task DNA is an enhancement, not a blocker for creating tasks.
    return deriveTaskDnaInsight([]);
  }

  const typedMatches: SimilarTaskMatch[] = (matches ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    estimatedMinutes: m.estimated_minutes,
    actualMinutes: m.actual_minutes,
    requiredEnergy: m.required_energy,
    similarity: m.similarity,
  }));

  return deriveTaskDnaInsight(typedMatches);
}
