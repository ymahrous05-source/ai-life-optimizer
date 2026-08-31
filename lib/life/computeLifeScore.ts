// =====================================================================
// computeLifeScore()
// Combines four otherwise-separate signals into a single 0-100 pulse:
//   - Mental battery remaining (cognitive load)
//   - Burnout risk (inverse contribution)
//   - Habit consistency (recent completion rate across active habits)
//   - Neglect decay: the score actively drops if the user hasn't
//     logged energy or completed anything in a while — absence itself
//     is a signal, not just bad readings.
// Weighted rather than averaged so a single catastrophic input (e.g.
// burnout risk spiking to 100) pulls the whole score down hard, the
// way it would actually feel.
// =====================================================================

export interface LifeScoreInput {
  mentalBatteryPercent: number; // 0-100
  burnoutRiskScore: number; // 0-100
  habitCompletionRate7d: number; // 0-1, fraction of active-habit-days completed in the last 7 days
  hoursSinceLastCheckIn: number; // hours since any energy_logs / task activity
  currentStreakDays: number; // longest active habit streak, for a small bonus
}

export interface LifeScoreResult {
  score: number; // 0-100
  trend: "rising" | "steady" | "falling";
  band: "thriving" | "steady" | "strained" | "critical";
  dominantFactor: string; // plain-language explanation of what's driving the score
}

const WEIGHTS = {
  battery: 0.35,
  burnout: 0.35, // inverted: (100 - burnoutRiskScore)
  habits: 0.2,
  streakBonus: 0.1,
};

const NEGLECT_DECAY_START_HOURS = 6; // grace period before decay kicks in
const NEGLECT_DECAY_PER_HOUR = 1.5; // points lost per hour past the grace period
const MAX_NEGLECT_PENALTY = 30;

export function computeLifeScore(
  input: LifeScoreInput,
  previousScore?: number
): LifeScoreResult {
  const batteryComponent = clamp(input.mentalBatteryPercent, 0, 100) * WEIGHTS.battery;
  const burnoutComponent = clamp(100 - input.burnoutRiskScore, 0, 100) * WEIGHTS.burnout;
  const habitComponent = clamp(input.habitCompletionRate7d * 100, 0, 100) * WEIGHTS.habits;
  const streakBonus = clamp((input.currentStreakDays / 30) * 100, 0, 100) * WEIGHTS.streakBonus;

  let raw = batteryComponent + burnoutComponent + habitComponent + streakBonus;

  const neglectHours = Math.max(0, input.hoursSinceLastCheckIn - NEGLECT_DECAY_START_HOURS);
  const neglectPenalty = Math.min(MAX_NEGLECT_PENALTY, neglectHours * NEGLECT_DECAY_PER_HOUR);
  raw -= neglectPenalty;

  const score = Math.round(clamp(raw, 0, 100));

  const trend: LifeScoreResult["trend"] =
    previousScore === undefined
      ? "steady"
      : score > previousScore + 2
      ? "rising"
      : score < previousScore - 2
      ? "falling"
      : "steady";

  const band: LifeScoreResult["band"] =
    score >= 75 ? "thriving" : score >= 50 ? "steady" : score >= 25 ? "strained" : "critical";

  const dominantFactor = explainDominantFactor(input, neglectPenalty);

  return { score, trend, band, dominantFactor };
}

function explainDominantFactor(input: LifeScoreInput, neglectPenalty: number): string {
  if (neglectPenalty >= 15) {
    return `No activity logged in ${Math.round(input.hoursSinceLastCheckIn)}h — check in to stop the drift.`;
  }
  if (input.burnoutRiskScore >= 60) {
    return "Burnout risk is the main drag right now.";
  }
  if (input.mentalBatteryPercent <= 30) {
    return "Mental battery is running low.";
  }
  if (input.habitCompletionRate7d < 0.4) {
    return "Habit consistency has slipped this week.";
  }
  if (input.currentStreakDays >= 7) {
    return `A ${input.currentStreakDays}-day streak is carrying the score.`;
  }
  return "All signals are in a healthy range.";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
