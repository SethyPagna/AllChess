import { NextResponse } from "next/server";

import { parseBoundedInteger, safeDecodeRouteSegment } from "@/lib/routing/params";
import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

type RouteContext = {
  params: Promise<{ profileId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { profileId } = await context.params;
  const decodedProfileId = safeDecodeRouteSegment(profileId);
  if (!decodedProfileId) {
    return NextResponse.json({ error: "Unknown profile." }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = parseBoundedInteger(url.searchParams.get("limit"), 20, { min: 1, max: 100 });
  const env = await getCloudflareRuntimeEnv();

  if (!env.ALLCHESS_D1) {
    return NextResponse.json({
      source: "empty-live-data",
      profileId: decodedProfileId,
      stats: [],
      results: []
    });
  }

  const repository = createD1GameRepository(env.ALLCHESS_D1);
  const [stats, results] = await Promise.all([repository.getProfileGameStats(decodedProfileId), repository.getProfileGameResults(decodedProfileId, limit)]);

  return NextResponse.json({
    source: "d1",
    profileId: decodedProfileId,
    stats,
    results
  });
}
