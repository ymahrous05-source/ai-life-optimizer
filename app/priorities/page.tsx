// =====================================================================
// app/priorities/page.tsx
// Cross-goal view of the Eisenhower Matrix / ABCDE / MoSCoW / 1-3-5
// frameworks across ALL of the user's active tasks (not scoped to a
// single goal, unlike app/goals/[id]/page.tsx).
// =====================================================================
import { createSupabaseServerClient } from "../../lib/supabase/server";
import PrioritizationMatrixView from "../../components/dashboard/PrioritizationMatrixView";
import { computeDynamicPriorityScore } from "../../lib/ai/autoRescheduleDay";

export default async function PrioritiesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deck-bg text-ink-primary">
        Please sign in to view your priorities.
      </div>
    );
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["backlog", "scheduled", "in_progress"]);

  const now = new Date();
  const enrichedTasks = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    eisenhowerQuadrant: t.eisenhower_quadrant,
    abcde: t.abcde,
    moscow: t.moscow,
    isIn1_3_5: t.is_in_1_3_5,
    one3_5Size: t.one_3_5_size,
    dynamicPriorityScore: computeDynamicPriorityScore(
      {
        id: t.id,
        estimatedMinutes: t.estimated_minutes,
        correctedMinutes: t.corrected_minutes,
        requiredEnergy: t.required_energy,
        codValue: t.cod_value,
        codUrgencyProfile: t.cod_urgency_profile,
        isHardDeadline: t.is_hard_deadline,
        deadlineAt: t.deadline_at,
        bufferMinutesBefore: t.buffer_minutes_before,
        bufferMinutesAfter: t.buffer_minutes_after,
      },
      now
    ),
  }));

  return (
    <div className="min-h-screen bg-deck-bg px-4 py-8">
      <header className="mx-auto mb-6 max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ink-faint">
          All Tasks
        </p>
        <h1 className="font-display text-xl font-semibold text-ink-primary">Priorities</h1>
        <p className="mt-1 font-body text-sm text-ink-muted">
          Every open task, across every goal, ranked by cost of delay.
        </p>
      </header>

      <div className="mx-auto max-w-3xl">
        <PrioritizationMatrixView tasks={enrichedTasks} />
      </div>
    </div>
  );
}
