import { getLeaderboardScopes } from "@/lib/catalog";
import { createD1GameRepository, type LeaderboardSnapshot } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

export type RuntimeLeaderboards = {
  source: "d1" | "empty-live-data";
  scopes: ReturnType<typeof getLeaderboardScopes>;
  leaderboards: LeaderboardSnapshot[];
};

export async function getRuntimeLeaderboards(): Promise<RuntimeLeaderboards> {
  const scopes = getLeaderboardScopes();
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return { source: "empty-live-data", scopes, leaderboards: [] };
  }

  try {
    return {
      source: "d1",
      scopes,
      leaderboards: await createD1GameRepository(env.ALLCHESS_D1).getLeaderboards()
    };
  } catch {
    return { source: "empty-live-data", scopes, leaderboards: [] };
  }
}
