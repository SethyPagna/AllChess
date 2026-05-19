import { NextResponse } from "next/server";

import { listD1CatalogEntries } from "@/lib/cloudflare/d1-catalog";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { parseCatalogFamily, parsePlayabilityStatus } from "@/lib/routing/params";
import { filterGameCatalogEntries, getCatalogStats, getGameCatalog, serializeCatalogEntry } from "@/lib/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const family = parseCatalogFamily(url.searchParams.get("family"));
  const playability = parsePlayabilityStatus(url.searchParams.get("playability"));
  const catalog = await getCatalogEntries();
  const entries = query || family || playability ? filterGameCatalogEntries(catalog, query, { family: family ?? undefined, playability: playability ?? undefined }) : catalog;

  return NextResponse.json({
    entries: entries.map(serializeCatalogEntry),
    stats: getCatalogStats(entries)
  });
}

async function getCatalogEntries() {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) return getGameCatalog();
  try {
    const entries = await listD1CatalogEntries(env.ALLCHESS_D1);
    return entries.length > 0 ? entries : getGameCatalog();
  } catch {
    return getGameCatalog();
  }
}
