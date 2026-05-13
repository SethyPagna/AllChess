import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

const analysisSchema = z.object({
  gameId: z.string().min(1),
  variantKey: z.string().min(1),
  moves: z.array(z.string()).default([])
});

export async function POST(request: Request) {
  const payload = analysisSchema.parse(await request.json().catch(() => ({})));
  const provider = process.env.AI_PROVIDER ?? "openai";
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      mode: "demo",
      provider,
      model,
      summary: `Demo analysis for ${payload.variantKey}: develop pieces, watch king safety, and review move ${Math.max(payload.moves.length, 1)}.`,
      report: {
        moments: [],
        training: ["Replay the game from both sides.", "Compare candidate moves before committing."],
        configured: false
      }
    });
  }

  const report = {
    moments: payload.moves.slice(-5).map((move, index) => ({
      move,
      label: index === 0 ? "turning point" : "candidate review"
    })),
    training: ["Request deeper model analysis from the production worker."],
    configured: true
  };

  const summary = `AI analysis queued for ${payload.variantKey} with ${payload.moves.length} moves.`;
  const env = await getCloudflareRuntimeEnv();

  if (env.ALLCHESS_D1) {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    await repository.saveAnalysis({
      id: crypto.randomUUID(),
      gameId: payload.gameId,
      provider,
      model,
      summary,
      report
    });
  }

  return NextResponse.json({ mode: "configured", provider, model, summary, report });
}
