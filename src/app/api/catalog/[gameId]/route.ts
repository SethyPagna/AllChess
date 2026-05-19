import { NextResponse } from "next/server";

import { safeDecodeRouteSegment } from "@/lib/api/route-params";
import { getGameCatalogEntry, serializeCatalogEntry } from "@/lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const decodedGameId = safeDecodeRouteSegment(gameId);
  const entry = decodedGameId ? getGameCatalogEntry(decodedGameId) : undefined;
  if (!entry) {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }
  return NextResponse.json(serializeCatalogEntry(entry));
}
