import { createD1GameRepository, type AnalysisReportSnapshot, type SavedMoveSnapshot } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

export type RuntimeAnalysisReview = {
  source: "d1" | "empty-live-data";
  gameId: string;
  analysis: AnalysisReportSnapshot | null;
  moves: SavedMoveSnapshot[];
};

export async function getRuntimeAnalysisReview(gameId: string, limit = 120): Promise<RuntimeAnalysisReview> {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    return createEmptyAnalysisReview(gameId);
  }

  try {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    const [analysis, moves] = await Promise.all([repository.getLatestAnalysis(gameId), repository.getSavedMoves(gameId, limit)]);
    return { source: "d1", gameId, analysis, moves };
  } catch {
    return createEmptyAnalysisReview(gameId);
  }
}

function createEmptyAnalysisReview(gameId: string): RuntimeAnalysisReview {
  return {
    source: "empty-live-data",
    gameId,
    analysis: null,
    moves: []
  };
}
