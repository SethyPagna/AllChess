import { NextResponse } from "next/server";
import { z } from "zod";

import { listTierBenchmarkResults, listVariantTrainingCoverage } from "@/lib/bot-training";
import { getBotStrengthBand } from "@/lib/bot-strength";

const benchmarkSchema = z.object({
  variantKey: z.string().min(1).default("classic"),
  tier: z.enum(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]).default("normal"),
  suite: z.string().min(1).default("smoke"),
  positions: z.number().int().nonnegative().default(0)
});

export async function POST(request: Request) {
  const body = benchmarkSchema.parse(await request.json().catch(() => ({})));
  const completedAt = new Date().toISOString();
  const benchmark = listTierBenchmarkResults().find((item) => item.tier === body.tier);
  const coverage = listVariantTrainingCoverage(body.variantKey)[0];

  return NextResponse.json({
    id: `${body.variantKey}-${body.tier}-${body.suite}-${Date.now()}`,
    variantKey: body.variantKey,
    tier: body.tier,
    strength: getBotStrengthBand(body.tier),
    claimStatus: coverage?.claimStatus ?? "preview-only",
    readiness: coverage?.readiness ?? "training",
    runtimePolicy: benchmark?.runtimePolicy ?? "cache-first",
    latencyTargetMs: benchmark?.latencyTargetMs ?? 2800,
    fixtureFamilies: benchmark?.fixtureFamilies ?? ["mate", "rescue", "counterattack", "draw-saving"],
    strongerThan: benchmark?.strongerThan,
    benchmarkVersion: benchmark?.benchmarkVersion,
    suite: body.suite,
    positions: body.positions,
    accepted: true,
    storagePlan: {
      summary: "D1 bot_benchmark_runs",
      artifacts: "R2 bot-benchmarks/"
    },
    completedAt
  });
}
