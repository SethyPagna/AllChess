import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { ticketId?: string };
  return NextResponse.json({ mode: "demo", left: Boolean(body.ticketId), ticketId: body.ticketId ?? null });
}
