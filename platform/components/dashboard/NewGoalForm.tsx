"use client";

// =====================================================================
// NewGoalForm
// Client form for creating a goal. If a target date is set, the flow
// pauses on a pre-mortem confirmation step — showing the Monte Carlo
// probability of hitting that deadline (grounded in the user's own
// historical variance) — before the goal is actually saved.
// =====================================================================
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGoalWithDecomposition,
  previewGoalDecomposition,
} from "../../app/actions/goals";
import { getGoalPremortem } from "../../app/actions/premortem";
import { getTaskDnaInsightForDraft } from "../../app/actions/taskDna";
import TaskDnaInsight from "../dna/TaskDnaInsight";
import GoalPremortemCard from "./GoalPremortemCard";
import type { DecomposedSubtask } from "../../lib/types";
import type { PremortemResult } from "../../lib/scheduling/goalPremortem";

type Stage = "form" | "checking" | "premortem" | "submitting" | "error";

export default function NewGoalForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [useReverseBlocking, setUseReverseBlocking] = useState(false);
  const [dailyCapacityHours, setDailyCapacityHours] = useState(4);
  const [stage, setStage] = useState<Stage>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feasibilityWarning, setFeasibilityWarning] = useState(false);

  const [previewSubtasks, setPreviewSubtasks] = useState<DecomposedSubtask[] | null>(null);
  const [premortem, setPremortem] = useState<PremortemResult | null>(null);

  async function handleReviewOrCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // No deadline — nothing to pre-mortem, create directly.
    if (!targetDate) {
      await commitGoal();
      return;
    }

    // Deadline set — decompose first and show the pre-mortem before saving.
    setStage("checking");
    try {
      const subtasks = await previewGoalDecomposition({
        title,
        description: description || undefined,
        targetDate,
      });
      setPreviewSubtasks(subtasks);

      const result = await getGoalPremortem(
        subtasks.map((s) => ({ estimatedMinutes: s.estimatedMinutes })),
        targetDate,
        dailyCapacityHours * 60
      );
      setPremortem(result);
      setStage("premortem");
    } catch (err) {
      setStage("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function commitGoal() {
    setStage("submitting");
    try {
      const result = await createGoalWithDecomposition({
        title,
        description: description || undefined,
        targetDate: targetDate || undefined,
        useReverseBlocking: useReverseBlocking && Boolean(targetDate),
        dailyCapacityMinutes: dailyCapacityHours * 60,
        precomputedSubtasks: previewSubtasks ?? undefined,
      });

      if (result.reverseFeasible === false) {
        setFeasibilityWarning(true);
        setStage("form");
        return;
      }

      router.push(`/goals/${result.goalId}`);
    } catch (err) {
      setStage("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (stage === "premortem" && premortem) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div>
          <p className="font-display text-xs uppercase tracking-wider text-ink-muted">
            {title}
          </p>
          <p className="font-body text-xs text-ink-faint">
            {previewSubtasks?.length} sub-tasks planned
          </p>
        </div>

        <GoalPremortemCard result={premortem} targetDate={targetDate} />

        {premortem.recommendation === "unrealistic" && (
          <div className="rounded-deck border border-signal-cost/40 bg-signal-cost/10 px-3 py-2">
            <p className="font-body text-xs text-signal-cost">
              Consider pushing the deadline back or cutting scope before committing.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStage("form")}
            className="flex-1 rounded-deck border border-deck-line px-4 py-2.5 font-body text-sm text-ink-muted transition hover:border-deck-line/70"
          >
            Adjust
          </button>
          <button
            type="button"
            onClick={commitGoal}
            className="flex-1 rounded-deck bg-energy-peak px-4 py-2.5 font-body text-sm font-medium text-deck-bg transition hover:opacity-90"
          >
            Commit anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleReviewOrCreate} className="mx-auto w-full max-w-lg space-y-5">
      <div>
        <label className="mb-1 block font-body text-xs text-ink-muted" htmlFor="title">
          Goal
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Launch the v2 marketing site"
          className="w-full rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-body text-sm text-ink-primary outline-none focus:border-energy-peak"
        />
      </div>

      <TaskDnaInsight
        draftTitle={title}
        draftDescription={description}
        onFetchInsight={getTaskDnaInsightForDraft}
      />

      <div>
        <label className="mb-1 block font-body text-xs text-ink-muted" htmlFor="description">
          Description <span className="text-ink-faint">(optional, helps the AI break it down)</span>
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full resize-none rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-body text-sm text-ink-primary outline-none focus:border-energy-peak"
        />
      </div>

      <div>
        <label className="mb-1 block font-body text-xs text-ink-muted" htmlFor="targetDate">
          Target date <span className="text-ink-faint">(optional)</span>
        </label>
        <input
          id="targetDate"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-mono text-sm text-ink-primary outline-none focus:border-energy-peak"
        />
        {targetDate && (
          <p className="mt-1 font-body text-[11px] text-ink-faint">
            We&apos;ll run a quick pre-mortem against your own history before saving.
          </p>
        )}
      </div>

      {targetDate && (
        <div className="rounded-deck border border-deck-line bg-deck-surface p-3">
          <label className="flex items-center gap-2 font-body text-sm text-ink-primary">
            <input
              type="checkbox"
              checked={useReverseBlocking}
              onChange={(e) => setUseReverseBlocking(e.target.checked)}
              className="h-4 w-4 accent-energy-peak"
            />
            Reverse-schedule from this deadline
          </label>

          <div className="mt-3">
            <label className="mb-1 block font-body text-xs text-ink-muted" htmlFor="capacity">
              Daily focus capacity: {dailyCapacityHours}h
            </label>
            <input
              id="capacity"
              type="range"
              min={1}
              max={10}
              value={dailyCapacityHours}
              onChange={(e) => setDailyCapacityHours(Number(e.target.value))}
              className="w-full accent-energy-peak"
            />
          </div>
        </div>
      )}

      {feasibilityWarning && (
        <div className="rounded-deck border border-signal-cost/40 bg-signal-cost/10 px-3 py-2">
          <p className="font-body text-xs text-signal-cost">
            This deadline isn&apos;t achievable at your current daily capacity — the plan would
            need to start before today. Increase daily hours, push the date back, or try again to
            save as best-effort.
          </p>
        </div>
      )}

      {errorMessage && <p className="font-body text-xs text-signal-cost">{errorMessage}</p>}

      <button
        type="submit"
        disabled={stage === "checking" || stage === "submitting"}
        className="w-full rounded-deck bg-energy-peak px-4 py-2.5 font-body text-sm font-medium text-deck-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {stage === "checking"
          ? "Running the numbers…"
          : stage === "submitting"
          ? "Saving…"
          : targetDate
          ? "Review before committing"
          : "Create goal"}
      </button>
    </form>
  );
}
