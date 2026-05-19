import { NextResponse } from "next/server";

import { getRuntimeLeaderboards } from "@/lib/leaderboards/runtime";

export async function GET() {
  return NextResponse.json(await getRuntimeLeaderboards());
}
