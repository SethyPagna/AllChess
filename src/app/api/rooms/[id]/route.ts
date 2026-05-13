import { NextResponse } from "next/server";

import { createRoomSnapshot } from "@/lib/realtime/rooms";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ mode: "demo", snapshot: createRoomSnapshot({ roomId: id }) });
}
