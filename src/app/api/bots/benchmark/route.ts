import { NextResponse } from "next/server";
import { z } from "zod";

import { listTierBenchmarkResults, listVariantTrainingCoverage } from "@/lib/bot-training";
import { getBotStrengthBand } from "@/lib/bot-strength";
import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

const benchmarkSchema = z.object({
  variantKey: z.string().min(1).default("classic"),
  tier: z.enum(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]).default("normal"),
  suite: z.string().min(1).default("smoke"),
  positions: z.number().int().nonnegative().default(0),
  score: z.number().default(0),
  illegalMoves: z.number().int().nonnegative().default(0)
});

export async function POST(request: Request) {
  const body = benchmarkSchema.parse(await request.json().catch(() => ({})));
  const completedAt = new Date().toISOString();
  const benchmark = listTierBenchmarkResults().find((item) => item.tier === body.tier);
  const coverage = listVariantTrainingCoverage(body.variantKey)[0];
  const id = `${body.variantKey}-${body.tier}-${body.suite}-${Date.now()}`;
  const benchmarkVersion = benchmark?.benchmarkVersion ?? "manual-benchmark-v1";
  const response = {
    id,
    variantKey: body.variantKey,
    tier: body.tier,
    strength: getBotStrengthBand(body.tier),
    claimStatus: coverage?.claimStatus ?? "preview-only",
    readiness: coverage?.readiness ?? "training",
    runtimePolicy: benchmark?.runtimePolicy ?? "cache-first",
    latencyTargetMs: benchmark?.latencyTargetMs ?? 2800,
    fixtureFamilies: benchmark?.fixtureFamilies ?? ["mate", "rescue", "counterattack", "draw-saving"],
    strongerThan: benchmark?.strongerThan,
    benchmarkVersion,
    suite: body.suite,
    positions: body.positions,
    score: body.score,
    illegalMoves: body.illegalMoves,
    accepted: true,
    persisted: false,
    storagePlan: {
      summary: "D1 bot_benchmark_runs",
      artifacts: "R2 bot-benchmarks/"
    },
    completedAt
  };

  const env = await getCloudflareRuntimeEnv();
  if (env.ALLCHESS_D1) {
    response.persisted = true;
    await createD1GameRepository(env.ALLCHESS_D1).saveBotBenchmark({
      id,
      variantKey: body.variantKey,
      tier: body.tier,
      benchmarkVersion,
      gamesPlayed: body.positions,
      score: body.score,
      illegalMoves: body.illegalMoves,
      summary: response
    });
  }

  return NextResponse.json(response);
}
