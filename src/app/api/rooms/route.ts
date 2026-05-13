import { NextResponse } from "next/server";
import { z } from "zod";

import { createRoomSnapshot } from "@/lib/realtime/rooms";

const createRoomSchema = z.object({
  variantKey: z.string().default("classic"),
  rated: z.boolean().default(false)
});

export async function POST(request: Request) {
  const body = createRoomSchema.parse(await request.json().catch(() => ({})));
  const snapshot = createRoomSnapshot({ variantKey: body.variantKey, rated: body.rated });
  return NextResponse.json({ mode: "demo", snapshot });
}
