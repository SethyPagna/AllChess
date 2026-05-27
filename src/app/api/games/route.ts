import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { getRuntimeRecentHistory, type HistoryResultFilter } from "@/lib/history/runtime";
import { createInitialState } from "@/lib/variants";

const createGameSchema = z.object({
  variantKey: z.string().default("classic"),
  privateRoom: z.boolean().default(false)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const query = url.searchParams.get("q") ?? undefined;
  const result = url.searchParams.get("result") ?? undefined;
  return NextResponse.json(await getRuntimeRecentHistory(Number.isFinite(limit) ? limit : 20, { query, result: result as HistoryResultFilter | undefined }));
}

export async function POST(request: Request) {
  const body = createGameSchema.parse(await request.json().catch(() => ({})));
  const state = createInitialState(body.variantKey);
  const env = await getCloudflareRuntimeEnv();

  if (!env.ALLCHESS_D1) {
    return NextResponse.json({
      mode: "demo",
      game: {
        id: state.id,
        variant_key: body.variantKey,
        status: "active",
        board_state: state
      }
    });
  }

  try {
    const repository = createD1GameRepository(env.ALLCHESS_D1);
    await repository.createGame({ state, privateRoom: body.privateRoom });
    return NextResponse.json({ mode: "d1", game: { id: state.id, variant_key: body.variantKey, status: state.status, board_state: state } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create game." }, { status: 400 });
  }
}
