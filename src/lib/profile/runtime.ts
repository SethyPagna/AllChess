import { createD1GameRepository, type ProfileGameResultSnapshot, type ProfileGameStatsSnapshot } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

export type RuntimeProfileHistory = {
  source: "d1" | "empty-live-data";
  profileId: string;
  stats: ProfileGameStatsSnapshot[];
  results: ProfileGameResultSnapshot[];
};

export async function getRuntimeProfileHistory(profileId: string, limit = 20): Promise<RuntimeProfileHistory> {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return createEmptyProfileHistory(profileId);
  }

  try {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    const [stats, results] = await Promise.all([repository.getProfileGameStats(profileId), repository.getProfileGameResults(profileId, limit)]);
    return { source: "d1", profileId, stats, results };
  } catch {
    return createEmptyProfileHistory(profileId);
  }
}

function createEmptyProfileHistory(profileId: string): RuntimeProfileHistory {
  return {
    source: "empty-live-data",
    profileId,
    stats: [],
    results: []
  };
}
