// =====================================================================
// Task DNA
// Given a set of the user's own past tasks that are semantically
// similar to a new one (retrieved via pgvector), derives a personalized
// duration/energy estimate — grounded in "you, specifically" rather
// than a generic category average.
// =====================================================================
import type { EnergyLevel } from "../types";

export interface SimilarTaskMatch {
  id: string;
  title: string;
  estimatedMinutes: number;
  actualMinutes: number;
  requiredEnergy: EnergyLevel;
  similarity: number; // 0-1, cosine similarity
}

export interface TaskDnaInsight {
  hasEnoughData: boolean;
  matchCount: number;
  suggestedMinutes: number | null;
  observedEnergy: EnergyLevel | null;
  averageOverrunRatio: number | null; // e.g. 1.8 = tends to take 80% longer than estimated
  narrative: string;
  topMatches: Pick<SimilarTaskMatch, "title" | "similarity">[];
}

const MIN_SIMILARITY = 0.72; // below this, matches are too loosely related to trust
const MIN_MATCHES_FOR_CONFIDENCE = 2;

const ENERGY_ORDER: EnergyLevel[] = ["trough", "low", "medium", "high", "peak"];

export function deriveTaskDnaInsight(matches: SimilarTaskMatch[]): TaskDnaInsight {
  const relevant = matches.filter((m) => m.similarity >= MIN_SIMILARITY);

  if (relevant.length < MIN_MATCHES_FOR_CONFIDENCE) {
    return {
      hasEnoughData: false,
      matchCount: relevant.length,
      suggestedMinutes: null,
      observedEnergy: null,
      averageOverrunRatio: null,
      narrative:
        relevant.length === 0
          ? "No closely similar past tasks yet — this will start building this task's DNA."
          : "Only one similar past task so far — not quite enough to trust a personalized estimate yet.",
      topMatches: relevant.map((m) => ({ title: m.title, similarity: m.similarity })),
    };
  }

  // Weight each match's contribution by its similarity, so closer matches
  // influence the estimate more than borderline ones.
  let weightedActualSum = 0;
  let weightedRatioSum = 0;
  let weightTotal = 0;
  const energyVotes = new Map<EnergyLevel, number>();

  for (const m of relevant) {
    const weight = m.similarity;
    weightedActualSum += m.actualMinutes * weight;
    weightedRatioSum += (m.actualMinutes / Math.max(1, m.estimatedMinutes)) * weight;
    weightTotal += weight;
    energyVotes.set(m.requiredEnergy, (energyVotes.get(m.requiredEnergy) ?? 0) + weight);
  }

  const suggestedMinutes = Math.round(weightedActualSum / weightTotal / 5) * 5; // round to nearest 5
  const averageOverrunRatio = Number((weightedRatioSum / weightTotal).toFixed(2));

  const observedEnergy = [...energyVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const narrative = buildNarrative(relevant.length, suggestedMinutes, averageOverrunRatio);

  return {
    hasEnoughData: true,
    matchCount: relevant.length,
    suggestedMinutes,
    observedEnergy,
    averageOverrunRatio,
    narrative,
    topMatches: relevant
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map((m) => ({ title: m.title, similarity: m.similarity })),
  };
}

function buildNarrative(matchCount: number, suggestedMinutes: number, ratio: number): string {
  const hours = suggestedMinutes / 60;
  const durationPhrase =
    hours >= 1 ? `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h` : `${suggestedMinutes}m`;

  if (ratio >= 1.3) {
    return `Based on ${matchCount} similar tasks you've completed, this tends to take about ${durationPhrase} — roughly ${Math.round((ratio - 1) * 100)}% longer than tasks like this are usually estimated.`;
  }
  if (ratio <= 0.8) {
    return `Based on ${matchCount} similar tasks you've completed, this usually goes faster than expected — about ${durationPhrase} in practice.`;
  }
  return `Based on ${matchCount} similar tasks you've completed, ${durationPhrase} is a realistic estimate for you.`;
}

/** Utility: is the observed energy meaningfully different from what was assumed? */
export function energyDrift(assumed: EnergyLevel, observed: EnergyLevel): number {
  return ENERGY_ORDER.indexOf(observed) - ENERGY_ORDER.indexOf(assumed);
}
