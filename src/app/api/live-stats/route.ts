import { NextResponse } from "next/server";

import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { createDemoLiveStats } from "@/lib/realtime/rooms";

export async function GET() {
  const env = await getCloudflareRuntimeEnv();
  if (env.ALLCHESS_D1) {
    return NextResponse.json(await createD1GameRepository(env.ALLCHESS_D1).getLiveStats());
  }
  return NextResponse.json(createDemoLiveStats());
}
