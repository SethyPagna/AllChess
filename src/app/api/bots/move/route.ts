import { NextResponse } from "next/server";
import { z } from "zod";

import { requestBotMove, type BotTierKey } from "@/lib/bots";
import type { GameState } from "@/lib/variants";

const botMoveSchema = z.object({
  state: z.custom<GameState>(),
  tier: z.enum(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]).default("normal"),
  engineMode: z.enum(["auto", "stockfish", "internal"]).default("auto"),
  maxSearchTimeMs: z.number().int().positive().max(5000).default(900),
  roomId: z.string().optional(),
  rated: z.boolean().optional()
});

export async function POST(request: Request) {
  const body = botMoveSchema.parse(await request.json());
  const result = await requestBotMove(body.state, body.tier as BotTierKey, {
    engine: body.engineMode,
    maxSearchTimeMs: body.maxSearchTimeMs,
    roomId: body.roomId,
    rated: body.rated
  });
  return NextResponse.json(result);
}
