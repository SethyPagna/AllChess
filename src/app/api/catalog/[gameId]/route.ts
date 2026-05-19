import { NextResponse } from "next/server";

import { getD1CatalogEntry } from "@/lib/cloudflare/d1-catalog";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { safeDecodeRouteSegment } from "@/lib/routing/params";
import { getGameCatalogEntry, serializeCatalogEntry } from "@/lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const decodedGameId = safeDecodeRouteSegment(gameId);
  const entry = decodedGameId ? await getCatalogEntry(decodedGameId) : undefined;
  if (!entry) {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }
  return NextResponse.json(serializeCatalogEntry(entry));
}

async function getCatalogEntry(gameId: string) {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) return getGameCatalogEntry(gameId);
  try {
    return (await getD1CatalogEntry(env.ALLCHESS_D1, gameId)) ?? getGameCatalogEntry(gameId);
  } catch {
    return getGameCatalogEntry(gameId);
  }
}
