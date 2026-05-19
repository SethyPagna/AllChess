import { NextResponse } from "next/server";

import { getRuntimeLiveStats } from "@/lib/realtime/runtime";

export async function GET() {
  return NextResponse.json(await getRuntimeLiveStats());
}
