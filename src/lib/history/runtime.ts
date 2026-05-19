import { createD1GameRepository, type ProfileGameResultSnapshot } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

const historyResults = ["all", "win", "loss", "draw", "unfinished"] as const;

export type HistoryResultFilter = (typeof historyResults)[number];

export type RecentHistoryFilters = {
  query?: string;
  result?: HistoryResultFilter;
};

export type RuntimeRecentHistory = {
  source: "d1" | "empty-live-data";
  results: ProfileGameResultSnapshot[];
  totalResults: number;
  filters: {
    query: string;
    result: HistoryResultFilter;
  };
};

export async function getRuntimeRecentHistory(limit = 20, filters: RecentHistoryFilters = {}): Promise<RuntimeRecentHistory> {
  const normalizedFilters = normalizeHistoryFilters(filters);
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return createEmptyHistory(normalizedFilters);
  }

  try {
    const sourceResults = await createD1GameRepository(env.ALLCHESS_D1).getRecentGameResults(Math.max(limit, 100));
    const filteredResults = filterHistoryResults(sourceResults, normalizedFilters).slice(0, limit);
    return {
      source: "d1",
      results: filteredResults,
      totalResults: sourceResults.length,
      filters: normalizedFilters
    };
  } catch {
    return createEmptyHistory(normalizedFilters);
  }
}

function normalizeHistoryFilters(filters: RecentHistoryFilters): RuntimeRecentHistory["filters"] {
  const result = historyResults.includes(filters.result ?? "all") ? filters.result ?? "all" : "all";
  return {
    query: filters.query?.trim().toLowerCase() ?? "",
    result
  };
}

function filterHistoryResults(results: ProfileGameResultSnapshot[], filters: RuntimeRecentHistory["filters"]) {
  return results.filter((result) => {
    const matchesResult = filters.result === "all" || result.result === filters.result;
    const searchableText = [
      result.gameId,
      result.profileId,
      result.variantKey,
      result.familyKey,
      result.timeControlKey,
      result.mode,
      result.opponentProfileId,
      result.opponentType,
      result.outcomeReason,
      result.result
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !filters.query || searchableText.includes(filters.query);
    return matchesResult && matchesQuery;
  });
}

function createEmptyHistory(filters: RuntimeRecentHistory["filters"]): RuntimeRecentHistory {
  return {
    source: "empty-live-data",
    results: [],
    totalResults: 0,
    filters
  };
}
