import NewGoalForm from "../../../components/dashboard/NewGoalForm";

export default function NewGoalPage() {
  return (
    <div className="min-h-screen bg-deck-bg px-4 py-10">
      <div className="mb-8 text-center">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ink-faint">
          New Goal
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink-primary">
          What are you working toward?
        </h1>
        <p className="mt-2 font-body text-sm text-ink-muted">
          Describe it in a sentence — the AI will break it into scheduled sub-tasks.
        </p>
      </div>
      <NewGoalForm />
    </div>
  );
}
