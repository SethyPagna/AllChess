import { NextResponse } from "next/server";

import { createMatchmakingTicket } from "@/lib/realtime/rooms";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Parameters<typeof createMatchmakingTicket>[0];
  return NextResponse.json({ mode: "demo", ticket: createMatchmakingTicket(body) });
}
