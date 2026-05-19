import { NextResponse } from "next/server";

import { parseCatalogFamily, parsePlayabilityStatus } from "@/lib/routing/params";
import { getCatalogStats, getGameCatalog, searchGameCatalog, serializeCatalogEntry } from "@/lib/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const family = parseCatalogFamily(url.searchParams.get("family"));
  const playability = parsePlayabilityStatus(url.searchParams.get("playability"));
  const entries = query || family || playability ? searchGameCatalog(query, { family: family ?? undefined, playability: playability ?? undefined }) : getGameCatalog();

  return NextResponse.json({
    entries: entries.map(serializeCatalogEntry),
    stats: getCatalogStats(entries)
  });
}
