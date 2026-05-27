import { NextResponse } from "next/server";

import { parseCatalogFamily, parsePlayabilityStatus } from "@/lib/routing/params";
import { filterGameCatalogEntries, getCatalogStats, serializeCatalogEntry } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const family = parseCatalogFamily(url.searchParams.get("family"));
  const playability = parsePlayabilityStatus(url.searchParams.get("playability"));
  const catalog = await getRuntimeCatalogEntries();
  const entries = query || family || playability ? filterGameCatalogEntries(catalog, query, { family: family ?? undefined, playability: playability ?? undefined }) : catalog;

  return NextResponse.json({
    entries: entries.map(serializeCatalogEntry),
    stats: getCatalogStats(entries)
  });
}
