import { NextResponse } from "next/server";

import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return NextResponse.json({ error: "WebSocket upgrade required." }, { status: 426 });
  }

  const env = await getCloudflareRuntimeEnv();
  if (!env.GAME_ROOM_DO) {
    return NextResponse.json({ error: "Realtime room sockets are unavailable in this environment." }, { status: 501 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const internalUrl = new URL(`/rooms/${encodeURIComponent(id)}${url.search}`, "https://allchess.internal");
  const durableId = env.GAME_ROOM_DO.idFromName(id);
  const stub = env.GAME_ROOM_DO.get(durableId);

  return (await stub.fetch(internalUrl.toString(), { headers: request.headers })) as unknown as Response;
}
