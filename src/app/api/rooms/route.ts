import { NextResponse } from "next/server";
import { z } from "zod";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { createRoomSnapshot } from "@/lib/realtime/rooms";

const createRoomSchema = z.object({
  variantKey: z.string().default("classic"),
  rated: z.boolean().default(false)
});

export async function POST(request: Request) {
  const body = createRoomSchema.parse(await request.json().catch(() => ({})));
  const snapshot = createRoomSnapshot({ variantKey: body.variantKey, rated: body.rated });
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) return NextResponse.json({ mode: "demo", snapshot });

  const repository = createD1GameRepository(env.ALLCHESS_D1);
  const room = await repository.createRoom({ snapshot });
  return NextResponse.json({ mode: "d1", snapshot, room });
}
