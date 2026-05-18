import { NextResponse } from "next/server";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

type RouteContext = {
  params: Promise<{ profileId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { profileId } = await context.params;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const env = await getCloudflareRuntimeEnv();

  if (!env.ALLCHESS_D1) {
    return NextResponse.json({
      source: "empty-live-data",
      profileId,
      stats: [],
      results: []
    });
  }

  const repository = createD1GameRepository(env.ALLCHESS_D1);
  const [stats, results] = await Promise.all([repository.getProfileGameStats(profileId), repository.getProfileGameResults(profileId, limit)]);

  return NextResponse.json({
    source: "d1",
    profileId,
    stats,
    results
  });
}
