import { NextResponse } from "next/server";

import { parseCatalogFamily, parsePlayabilityStatus } from "@/lib/routing/params";
import { filterGameCatalogEntries, getCatalogStats, serializeCatalogEntry, type CatalogPlayMode } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const family = parseCatalogFamily(url.searchParams.get("family"));
  const mode = parseCatalogMode(url.searchParams.get("mode"));
  const playability = parsePlayabilityStatus(url.searchParams.get("playability"));
  const catalog = await getRuntimeCatalogEntries();
  const entries =
    query || family || mode || playability
      ? filterGameCatalogEntries(catalog, query, { family: family ?? undefined, mode: mode ?? undefined, playability: playability ?? undefined })
      : catalog;

  return NextResponse.json({
    entries: entries.map(serializeCatalogEntry),
    stats: getCatalogStats(entries)
  });
}

function parseCatalogMode(value: string | null): CatalogPlayMode | undefined {
  if (!value) return undefined;
  return ["online", "bot", "offline", "room", "spectate"].includes(value) ? (value as CatalogPlayMode) : undefined;
}
