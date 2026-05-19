import { createD1GameRepository, type ProfileGameResultSnapshot } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

export type RuntimeRecentHistory = {
  source: "d1" | "empty-live-data";
  results: ProfileGameResultSnapshot[];
};

export async function getRuntimeRecentHistory(limit = 20): Promise<RuntimeRecentHistory> {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return { source: "empty-live-data", results: [] };
  }

  try {
    return {
      source: "d1",
      results: await createD1GameRepository(env.ALLCHESS_D1).getRecentGameResults(limit)
    };
  } catch {
    return { source: "empty-live-data", results: [] };
  }
}
