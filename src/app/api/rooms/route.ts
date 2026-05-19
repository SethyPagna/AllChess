import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { createRoomSnapshot } from "@/lib/realtime/rooms";
import { getRuntimeRoomList } from "@/lib/realtime/runtime";

const createRoomSchema = z.object({
  variantKey: z.string().default("classic"),
  rated: z.boolean().default(false),
  visibility: z.enum(["public", "private", "unlisted"]).default("public")
});

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const status = searchParams.get("status");
  return NextResponse.json(
    await getRuntimeRoomList({
      limit: Number.isFinite(limit) ? limit : 20,
      query: searchParams.get("q") ?? undefined,
      sort: searchParams.get("sort") === "spectators" ? "spectators" : "recent",
      status: status === "active" || status === "waiting" ? status : "all"
    })
  );
}

export async function POST(request: Request) {
  const body = createRoomSchema.parse(await request.json().catch(() => ({})));
  const snapshot = createRoomSnapshot({ variantKey: body.variantKey, rated: body.rated });
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) return NextResponse.json({ mode: "demo", snapshot });

  const repository = createD1GameRepository(env.ALLCHESS_D1);
  const room = await repository.createRoom({ snapshot, visibility: body.visibility });
  return NextResponse.json({ mode: "d1", snapshot, room });
}
