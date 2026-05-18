import { NextResponse } from "next/server";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { getLeaderboardScopes } from "@/lib/catalog";

export async function GET() {
  const env = await getCloudflareRuntimeEnv();
  if (env.ALLCHESS_D1) {
    return NextResponse.json({
      source: "d1",
      scopes: getLeaderboardScopes(),
      leaderboards: await createD1GameRepository(env.ALLCHESS_D1).getLeaderboards()
    });
  }

  return NextResponse.json({
    source: "empty-live-data",
    scopes: getLeaderboardScopes(),
    leaderboards: []
  });
}
