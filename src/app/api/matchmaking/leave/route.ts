import { NextResponse } from "next/server";

import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { fetchDurableJson } from "@/lib/realtime/durable-client";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { ticketId?: string };
  const env = await getCloudflareRuntimeEnv();
  const durable = await fetchDurableJson<{ left?: boolean; error?: string }>(env.MATCHMAKING_DO, "global-matchmaking", "/matchmaking/leave", {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (durable) {
    return NextResponse.json({ mode: "durable-object", ticketId: body.ticketId ?? null, ...durable.data }, { status: durable.status });
  }

  return NextResponse.json({ mode: "demo", left: Boolean(body.ticketId), ticketId: body.ticketId ?? null });
}
