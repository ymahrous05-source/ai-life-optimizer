// =====================================================================
// runGoalPremortem()
// Before the user commits to a deadline, simulates hundreds of possible
// "how this actually goes" outcomes using the user's OWN historical
// planning correction factor and interruption rate as the variance
// source — not a generic estimate. Returns a probability of finishing
// on time, plus the range of likely completion dates.
// =====================================================================

export interface PremortemSubtask {
  estimatedMinutes: number;
}

export interface PremortemInput {
  subtasks: PremortemSubtask[];
  targetDate: Date;
  now: Date;
  dailyCapacityMinutes: number;
  // User's own historical variance — from calculateBurnoutAndCorrection /
  // computePlanningCorrectionFactor and recent focus-session data.
  meanCorrectionFactor: number; // e.g. 1.35 = tasks tend to take 35% longer
  correctionFactorStdDev: number; // spread of that ratio across past tasks
  interruptionRate: number; // 0-1, fraction of sessions historically interrupted
  simulations?: number; // default 500
}

export interface PremortemResult {
  probabilityOnTime: number; // 0-1
  medianCompletionDate: string; // ISO date
  p10CompletionDate: string; // optimistic (10th percentile)
  p90CompletionDate: string; // pessimistic (90th percentile)
  narrative: string;
  recommendation: "confident" | "tight" | "risky" | "unrealistic";
}

/** Box-Muller transform for a normally-distributed random sample. */
function sampleNormal(mean: number, stdDev: number): number {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

export function runGoalPremortem(input: PremortemInput): PremortemResult {
  const simulations = input.simulations ?? 500;
  const totalEstimatedMinutes = input.subtasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const completionDaysSamples: number[] = [];

  for (let i = 0; i < simulations; i++) {
    // Each simulated "world" draws its own correction factor from the
    // user's historical distribution — some runs go smoothly, some don't.
    const drawnFactor = Math.max(
      0.5,
      sampleNormal(input.meanCorrectionFactor, input.correctionFactorStdDev)
    );

    // Interruptions add lost time on top of the raw duration: each
    // interrupted session historically costs ~20% extra recovery time.
    const interruptionPenalty = 1 + input.interruptionRate * 0.2 * (0.5 + Math.random());

    const simulatedTotalMinutes = totalEstimatedMinutes * drawnFactor * interruptionPenalty;

    // Also add some day-to-day noise in how much capacity is actually
    // available (sick days, meetings that run over, etc).
    const effectiveDailyCapacity = input.dailyCapacityMinutes * (0.75 + Math.random() * 0.35);

    const daysNeeded = Math.ceil(simulatedTotalMinutes / Math.max(1, effectiveDailyCapacity));
    completionDaysSamples.push(daysNeeded);
  }

  completionDaysSamples.sort((a, b) => a - b);

  const daysAvailable = Math.max(
    0,
    Math.round((input.targetDate.getTime() - input.now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const onTimeCount = completionDaysSamples.filter((d) => d <= daysAvailable).length;
  const probabilityOnTime = Number((onTimeCount / simulations).toFixed(2));

  const percentile = (p: number) =>
    completionDaysSamples[Math.min(simulations - 1, Math.floor((p / 100) * simulations))];

  const medianDays = percentile(50);
  const p10Days = percentile(10); // optimistic — fewer days
  const p90Days = percentile(90); // pessimistic — more days

  const addDays = (days: number) => {
    const d = new Date(input.now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const recommendation: PremortemResult["recommendation"] =
    probabilityOnTime >= 0.75
      ? "confident"
      : probabilityOnTime >= 0.5
      ? "tight"
      : probabilityOnTime >= 0.25
      ? "risky"
      : "unrealistic";

  const narrative = buildNarrative(probabilityOnTime, recommendation, daysAvailable, medianDays);

  return {
    probabilityOnTime,
    medianCompletionDate: addDays(medianDays),
    p10CompletionDate: addDays(p10Days),
    p90CompletionDate: addDays(p90Days),
    narrative,
    recommendation,
  };
}

function buildNarrative(
  probability: number,
  recommendation: PremortemResult["recommendation"],
  daysAvailable: number,
  medianDays: number
): string {
  const pct = Math.round(probability * 100);

  switch (recommendation) {
    case "confident":
      return `Based on how your estimates have historically played out, you have about a ${pct}% chance of finishing by the deadline — this looks achievable with normal buffer.`;
    case "tight":
      return `About a ${pct}% chance of finishing on time based on your history. Your typical pace suggests ${medianDays} days, against ${daysAvailable} available — it's doable but there's little room for surprises.`;
    case "risky":
      return `Only around a ${pct}% chance of hitting this deadline given how your estimates have gone before. Your typical pace needs ~${medianDays} days but you only have ${daysAvailable}.`;
    case "unrealistic":
      return `This deadline looks unrealistic based on your track record — only a ${pct}% chance of finishing on time. Consider extending the date or cutting scope.`;
  }
}
