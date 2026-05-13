import { NextResponse } from "next/server";

import { createDemoLiveStats } from "@/lib/realtime/rooms";

export async function GET() {
  return NextResponse.json(createDemoLiveStats());
}
