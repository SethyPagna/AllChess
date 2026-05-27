import { NextResponse } from "next/server";

import { getRuntimeProfileHistory } from "@/lib/profile/runtime";
import { parseBoundedInteger, safeDecodeRouteSegment } from "@/lib/routing/params";

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
  return NextResponse.json(await getRuntimeProfileHistory(decodedProfileId, limit));
}
