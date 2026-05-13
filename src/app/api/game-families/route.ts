import { NextResponse } from "next/server";

import { gameFamilies, getCatalogStats } from "@/lib/catalog";

export async function GET() {
  const stats = getCatalogStats();
  return NextResponse.json({
    families: gameFamilies.map((family) => ({
      ...family,
      games: stats.familyCounts[family.key]
    }))
  });
}
