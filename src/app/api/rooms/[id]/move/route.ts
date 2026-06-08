import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { applyAuthoritativeRoomMove, createRoomSnapshot } from "@/lib/realtime/rooms";
import { fetchDurableJson } from "@/lib/realtime/durable-client";
import type { ServerRealtimeMessage } from "@/lib/realtime/types";
import type { Move } from "@/lib/variants";

const squareSchema = z.object({
  row: z.number().int(),
  col: z.number().int()
});

const pieceSchema = z.object({
  id: z.string(),
  code: z.string(),
  labelKey: z.string(),
  owner: z.enum(["white", "black", "red", "blue", "sente", "gote"]),
  promoted: z.boolean().optional()
});

const moveSchema: z.ZodType<Move> = z.object({
  kind: z.enum(["move", "drop", "pass", "remove"]).optional(),
  from: squareSchema,
  to: squareSchema,
  promotion: z.boolean().optional(),
  drop: pieceSchema.optional()
});

const roomMoveSchema = z.object({
  move: moveSchema,
  expectedMoveVersion: z.number().int().min(0)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = roomMoveSchema.parse(await request.json().catch(() => ({})));
  const env = await getCloudflareRuntimeEnv();

  if (env.ALLCHESS_D1) {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    const snapshot = await repository.getRoomSnapshot(id);
    if (snapshot) {
      if (body.expectedMoveVersion !== snapshot.moveVersion) {
        return NextResponse.json({ mode: "d1", type: "move_rejected", reason: "Stale move.", expectedMoveVersion: snapshot.moveVersion }, { status: 409 });
      }

      const result = applyAuthoritativeRoomMove(snapshot, body.move);
      if (!result.ok) {
        return NextResponse.json({ mode: "d1", type: "move_rejected", reason: result.reason, expectedMoveVersion: snapshot.moveVersion }, { status: 400 });
      }

      await repository.recordMove({ gameId: result.snapshot.gameId, state: result.snapshot.state, move: body.move });
      return NextResponse.json({ mode: "d1", type: "move_applied", snapshot: result.snapshot, move: body.move });
    }
  }

  const durable = await fetchDurableJson<ServerRealtimeMessage>(env.GAME_ROOM_DO, id, `/rooms/${encodeURIComponent(id)}/move`, {
    method: "POST",
    body: JSON.stringify({ type: "make_move", roomId: id, move: body.move, expectedMoveVersion: body.expectedMoveVersion })
  });

  if (durable) {
    return NextResponse.json({ mode: "durable-object", ...durable.data }, { status: durable.status });
  }

  const snapshot = createRoomSnapshot({ roomId: id });
  if (body.expectedMoveVersion !== snapshot.moveVersion) {
    return NextResponse.json({ mode: "demo", type: "move_rejected", reason: "Stale move.", expectedMoveVersion: snapshot.moveVersion }, { status: 409 });
  }

  const result = applyAuthoritativeRoomMove(snapshot, body.move);
  if (!result.ok) {
    return NextResponse.json({ mode: "demo", type: "move_rejected", reason: result.reason, expectedMoveVersion: snapshot.moveVersion }, { status: 400 });
  }

  return NextResponse.json({ mode: "demo", type: "move_applied", snapshot: result.snapshot, move: body.move });
}
