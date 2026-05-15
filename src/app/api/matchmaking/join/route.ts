import { NextResponse } from "next/server";

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
    return NextResponse.json({ mode: "durable-object", ...durable.data }, { status: durable.status });
  }

  return NextResponse.json({ mode: "demo", ticket: createMatchmakingTicket(body) });
}
