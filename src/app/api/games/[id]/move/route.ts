import { NextResponse } from "next/server";
import { z } from "zod";

import { applyMove, type GameState } from "@/lib/variants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ mode: "demo", gameId: id, state: nextState });
  }

  const { error: gameError } = await supabase
    .from("games")
    .update({
      board_state: nextState,
      current_turn: nextState.turn,
      status: nextState.status
    })
    .eq("id", id);

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 400 });
  }

  const lastMove = nextState.moves[nextState.moves.length - 1];
  const { error: moveError } = await supabase.from("moves").insert({
    game_id: id,
    ply: nextState.ply,
    move: parsed.move,
    notation: lastMove?.notation ?? "",
    board_state_after: nextState
  });

  if (moveError) {
    return NextResponse.json({ error: moveError.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "supabase", state: nextState });
}
