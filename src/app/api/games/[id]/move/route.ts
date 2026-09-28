import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { moveKindAllowed, refineMoveRequest } from "@/lib/realtime/move-request";
import { applyMove, type GameState, type Move } from "@/lib/variants";

const squareSchema = z.object({ row: z.number().int(), col: z.number().int() });
const pieceSchema = z.object({
  id: z.string(),
  code: z.string(),
  labelKey: z.string(),
  owner: z.enum(["white", "black", "red", "blue", "sente", "gote"]),
  promoted: z.boolean().optional()
});

const movePayloadSchema = z
  .object({
    // Konane opening removals name one square (to == from).
    kind: z.enum(["move", "drop", "remove"]).optional(),
    from: squareSchema.optional(),
    to: squareSchema,
    promotion: z.boolean().optional(),
    // Western promotion piece (q, r, b, n; antichess also k). Omitted means queen.
    promoteTo: z.string().regex(/^[a-z]$/).optional(),
    drop: pieceSchema.optional()
  })
  .superRefine((move, context) => {
    if ((move.kind ?? "move") === "move" && !move.from) {
      context.addIssue({ code: "custom", path: ["from"], message: "Normal moves require a source square." });
    }
    refineMoveRequest(move, context);
  });

const moveSchema = z.object({
  state: z.custom<GameState>().optional(),
  expectedPly: z.number().int().nonnegative().optional(),
  move: movePayloadSchema
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = moveSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "errors.invalidMove" }, { status: 400 });
  const parsed = body.data;
  const env = await getCloudflareRuntimeEnv();

  if (!env.ALLCHESS_D1) {
    if (!parsed.state) return NextResponse.json({ error: "A game state is required when D1 is unavailable." }, { status: 400 });
    if (parsed.expectedPly !== undefined && parsed.state.ply !== parsed.expectedPly) {
      return NextResponse.json({ error: "Stale game state.", expectedPly: parsed.state.ply }, { status: 409 });
    }
    if (!moveKindAllowed(parsed.state.variantKey, parsed.move.kind)) return NextResponse.json({ error: "errors.invalidMove" }, { status: 400 });
    const nextState = applyMove(parsed.state, parsed.move as Move);
    return NextResponse.json({ mode: "demo", gameId: id, state: nextState });
  }

  try {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    const currentState = await repository.getGameState(id);
    if (!currentState) return NextResponse.json({ error: "Game not found." }, { status: 404 });
    if (parsed.expectedPly !== undefined && currentState.ply !== parsed.expectedPly) {
      return NextResponse.json({ error: "Stale game state.", expectedPly: currentState.ply }, { status: 409 });
    }
    const move = parsed.move as Move;
    if (!moveKindAllowed(currentState.variantKey, move.kind)) return NextResponse.json({ error: "errors.invalidMove" }, { status: 400 });
    const nextState = applyMove(currentState, move);
    await repository.recordMove({ gameId: id, state: nextState, move });
    return NextResponse.json({ mode: "d1", state: nextState });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record move." }, { status: 400 });
  }
}
