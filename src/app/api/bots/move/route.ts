import { NextResponse } from "next/server";
import { z } from "zod";

import { requestBotMove } from "@/lib/bot/runtime";
import { isBotTierKey, type BotTierKey } from "@/lib/bot/strength";
import type { GameState } from "@/lib/variants";

const botMoveSchema = z.object({
  state: z.custom<GameState>(),
  tier: z.string().refine(isBotTierKey).default("normal"),
  engineMode: z.enum(["auto", "stockfish", "internal"]).default("auto"),
  maxSearchTimeMs: z.number().int().positive().max(3000).default(900),
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
