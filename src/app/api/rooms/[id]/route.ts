import { NextResponse } from "next/server";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { createRoomSnapshot } from "@/lib/realtime/rooms";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = await getCloudflareRuntimeEnv();
  if (env.ALLCHESS_D1) {
    const snapshot = await createD1GameRepository(env.ALLCHESS_D1).getRoomSnapshot(id);
    if (!snapshot) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    return NextResponse.json({ mode: "d1", snapshot });
  }

  return NextResponse.json({ mode: "demo", snapshot: createRoomSnapshot({ roomId: id }) });
}
