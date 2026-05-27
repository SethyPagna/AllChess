import { NextResponse } from "next/server";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { fetchDurableJson } from "@/lib/realtime/durable-client";
import { createMatchmakingTicket } from "@/lib/realtime/rooms";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Parameters<typeof createMatchmakingTicket>[0];
  const env = await getCloudflareRuntimeEnv();
  const durable = await fetchDurableJson<{ ticket?: ReturnType<typeof createMatchmakingTicket>; error?: string }>(env.MATCHMAKING_DO, "global-matchmaking", "/matchmaking/join", {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (durable) {
    if (env.ALLCHESS_D1 && durable.data.ticket) {
      await createD1GameRepository(env.ALLCHESS_D1).saveMatchmakingTicket(durable.data.ticket);
    }
    return NextResponse.json({ mode: "durable-object", ...durable.data }, { status: durable.status });
  }

  const ticket = createMatchmakingTicket(body);
  if (env.ALLCHESS_D1) {
    await createD1GameRepository(env.ALLCHESS_D1).saveMatchmakingTicket(ticket);
    return NextResponse.json({ mode: "d1", ticket });
  }

  return NextResponse.json({ mode: "demo", ticket });
}
