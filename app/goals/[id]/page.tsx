// =====================================================================
// app/goals/[id]/page.tsx
// Server Component: shows a single goal's sub-tasks. If the goal was
// reverse-planned, renders the ReverseTimelineView; otherwise renders
// the PrioritizationMatrixView so the user can see how the AI classified
// each sub-task across the Eisenhower/ABCDE/MoSCoW/1-3-5 frameworks.
// =====================================================================
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import ReverseTimelineView from "../../../components/dashboard/ReverseTimelineView";
import PrioritizationMatrixView from "../../../components/dashboard/PrioritizationMatrixView";
import { reverseTimeBlock } from "../../../lib/scheduling/reverseTimeBlock";
import { computeDynamicPriorityScore } from "../../../lib/ai/autoRescheduleDay";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: goal } = await supabase.from("goals").select("*").eq("id", id).single();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("goal_id", id)
    .order("created_at", { ascending: true });

  if (!goal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deck-bg text-ink-muted">
        Goal not found.
      </div>
    );
  }

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

  let reverseResult = null;
  if (goal.is_reverse_planned && goal.target_date) {
    reverseResult = reverseTimeBlock({
      targetDate: new Date(goal.target_date),
      subtasks: (tasks ?? []).map((t, i) => ({
        id: t.id,
        title: t.title,
        estimatedMinutes: t.estimated_minutes,
        orderIndex: i,
      })),
      dailyCapacityMinutes: 240,
      workStartHour: 9,
    });
  }

  return (
    <div className="min-h-screen bg-deck-bg px-4 py-8">
      <header className="mx-auto mb-6 max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ink-faint">Goal</p>
        <h1 className="font-display text-xl font-semibold text-ink-primary">{goal.title}</h1>
        {goal.description && (
          <p className="mt-1 font-body text-sm text-ink-muted">{goal.description}</p>
        )}
      </header>

      <div className="mx-auto max-w-3xl">
        {reverseResult ? (
          <ReverseTimelineView
            goalTitle={goal.title}
            targetDate={goal.target_date}
            result={reverseResult}
          />
        ) : (
          <PrioritizationMatrixView tasks={enrichedTasks} />
        )}
      </div>
    </div>
  );
}
