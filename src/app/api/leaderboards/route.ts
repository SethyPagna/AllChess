import { NextResponse } from "next/server";

import { getRuntimeLeaderboards } from "@/lib/leaderboards/runtime";

export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope") ?? undefined;
  return NextResponse.json(await getRuntimeLeaderboards({ scope }));
}
