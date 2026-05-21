import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { generateChessAnalysis } from "@/lib/analysis/ai-provider";
import { getRuntimeAnalysisReview } from "@/lib/analysis/runtime";

const analysisSchema = z.object({
  gameId: z.string().min(1),
  variantKey: z.string().min(1),
  moves: z.array(z.string()).default([])
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gameId = url.searchParams.get("gameId")?.trim();
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "120", 10);

  if (!gameId) {
    return NextResponse.json({ error: "gameId is required." }, { status: 400 });
  }

  return NextResponse.json(await getRuntimeAnalysisReview(gameId, Number.isFinite(limit) ? limit : 120));
}

export async function POST(request: Request) {
  const payload = analysisSchema.parse(await request.json().catch(() => ({})));
  const analysis = await generateChessAnalysis(payload);
  const env = await getCloudflareRuntimeEnv();

  if (env.ALLCHESS_D1 && analysis.mode === "configured") {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    await repository.saveAnalysis({
      id: crypto.randomUUID(),
      gameId: payload.gameId,
      provider: analysis.provider,
      model: analysis.model,
      summary: analysis.summary,
      report: analysis.report
    });
  }

  return NextResponse.json(analysis);
}
