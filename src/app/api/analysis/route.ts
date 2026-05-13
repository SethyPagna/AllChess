import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { generateChessAnalysis } from "@/lib/ai-provider";

const analysisSchema = z.object({
  gameId: z.string().min(1),
  variantKey: z.string().min(1),
  moves: z.array(z.string()).default([])
});

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
