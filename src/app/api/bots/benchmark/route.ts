import { NextResponse } from "next/server";
import { z } from "zod";

const benchmarkSchema = z.object({
  variantKey: z.string().min(1).default("classic"),
  tier: z.enum(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]).default("normal"),
  suite: z.string().min(1).default("smoke"),
  positions: z.number().int().nonnegative().default(0)
});

export async function POST(request: Request) {
  const body = benchmarkSchema.parse(await request.json().catch(() => ({})));
  const completedAt = new Date().toISOString();

  return NextResponse.json({
    id: `${body.variantKey}-${body.tier}-${body.suite}-${Date.now()}`,
    variantKey: body.variantKey,
    tier: body.tier,
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
