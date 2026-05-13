import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { applyMove, type GameState } from "@/lib/variants";

const moveSchema = z.object({
  state: z.custom<GameState>(),
  move: z.object({
    from: z.object({ row: z.number().int(), col: z.number().int() }),
    to: z.object({ row: z.number().int(), col: z.number().int() }),
    promotion: z.boolean().optional()
  })
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = moveSchema.parse(await request.json());
  const nextState = applyMove(parsed.state, parsed.move);
  const env = await getCloudflareRuntimeEnv();

  if (!env.ALLCHESS_D1) {
    return NextResponse.json({ mode: "demo", gameId: id, state: nextState });
  }

  try {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    await repository.recordMove({ gameId: id, state: nextState, move: parsed.move });
    return NextResponse.json({ mode: "d1", state: nextState });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record move." }, { status: 400 });
  }
}
