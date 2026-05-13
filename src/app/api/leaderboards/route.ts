import { NextResponse } from "next/server";

import { getLeaderboardScopes } from "@/lib/catalog";

export async function GET() {
  return NextResponse.json({
    source: "empty-live-data",
    scopes: getLeaderboardScopes(),
    leaderboards: []
  });
}
