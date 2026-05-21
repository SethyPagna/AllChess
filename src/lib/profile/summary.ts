import type { RuntimeProfileHistory } from "@/lib/profile/runtime";

export type ProfileHistorySummary = {
  bestRating: number | null;
  gamesPlayed: number;
  recentResult: string | null;
};

export function summarizeProfileHistory(history: RuntimeProfileHistory): ProfileHistorySummary {
  const gamesPlayed = history.stats.reduce((total, stat) => total + stat.gamesPlayed, 0);
  const bestRating = history.stats.reduce<number | null>((best, stat) => {
    if (stat.bestRating == null) return best;
    return best == null ? stat.bestRating : Math.max(best, stat.bestRating);
  }, null);
  const recentResult = history.results[0]?.result;

  return {
    gamesPlayed,
    bestRating,
    recentResult: recentResult ? recentResult[0].toUpperCase() + recentResult.slice(1) : null
  };
}
