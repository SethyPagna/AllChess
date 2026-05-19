import { getLeaderboardScopes } from "@/lib/catalog";
import { createD1GameRepository, type LeaderboardSnapshot } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

export type LeaderboardFilters = {
  scope?: string;
};

export type RuntimeLeaderboards = {
  source: "d1" | "empty-live-data";
  scopes: ReturnType<typeof getLeaderboardScopes>;
  leaderboards: LeaderboardSnapshot[];
  filters: {
    scope: string;
  };
  totalLeaderboards: number;
};

export async function getRuntimeLeaderboards(filters: LeaderboardFilters = {}): Promise<RuntimeLeaderboards> {
  const scopes = getLeaderboardScopes();
  const normalizedFilters = normalizeLeaderboardFilters(filters, scopes);
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return createEmptyLeaderboards(scopes, normalizedFilters);
  }

  try {
    const leaderboards = await createD1GameRepository(env.ALLCHESS_D1).getLeaderboards();
    return {
      source: "d1",
      scopes,
      leaderboards: filterLeaderboards(leaderboards, normalizedFilters),
      filters: normalizedFilters,
      totalLeaderboards: leaderboards.length
    };
  } catch {
    return createEmptyLeaderboards(scopes, normalizedFilters);
  }
}

function normalizeLeaderboardFilters(filters: LeaderboardFilters, scopes: RuntimeLeaderboards["scopes"]): RuntimeLeaderboards["filters"] {
  const scope = filters.scope?.trim() || "all";
  return {
    scope: scope === "all" || scopes.some((candidate) => candidate.id === scope) ? scope : "all"
  };
}

function filterLeaderboards(leaderboards: LeaderboardSnapshot[], filters: RuntimeLeaderboards["filters"]) {
  if (filters.scope === "all") return leaderboards;
  const familyKey = filters.scope.startsWith("family:") ? filters.scope.slice("family:".length) : null;
  return leaderboards.filter((leaderboard) => {
    if (leaderboard.scopeId === filters.scope) return true;
    if (familyKey && leaderboard.familyKey === familyKey) return true;
    if (filters.scope === "playable") return Boolean(leaderboard.gameId);
    return false;
  });
}

function createEmptyLeaderboards(scopes: RuntimeLeaderboards["scopes"], filters: RuntimeLeaderboards["filters"]): RuntimeLeaderboards {
  return {
    source: "empty-live-data",
    scopes,
    leaderboards: [],
    filters,
    totalLeaderboards: 0
  };
}
