import { NextResponse } from "next/server";

import { getCatalogStats, getGameCatalog, searchGameCatalog, serializeCatalogEntry, type GameFamilyKey, type PlayabilityStatus } from "@/lib/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const family = url.searchParams.get("family") as GameFamilyKey | null;
  const playability = url.searchParams.get("playability") as PlayabilityStatus | null;
  const entries = query || family || playability ? searchGameCatalog(query, { family: family ?? undefined, playability: playability ?? undefined }) : getGameCatalog();

  return NextResponse.json({
    entries: entries.map(serializeCatalogEntry),
    stats: getCatalogStats(entries)
  });
}
