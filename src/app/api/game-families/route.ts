import { NextResponse } from "next/server";

import { gameFamilies, getCatalogStats } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";

export async function GET() {
  const stats = getCatalogStats(await getRuntimeCatalogEntries());
  return NextResponse.json({
    families: gameFamilies.map((family) => ({
      ...family,
      games: stats.familyCounts[family.key]
    }))
  });
}
