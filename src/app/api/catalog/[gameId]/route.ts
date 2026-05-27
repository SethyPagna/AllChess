import { NextResponse } from "next/server";

import { safeDecodeRouteSegment } from "@/lib/routing/params";
import { serializeCatalogEntry } from "@/lib/catalog";
import { getRuntimeCatalogEntry } from "@/lib/catalog/runtime";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const decodedGameId = safeDecodeRouteSegment(gameId);
  const entry = decodedGameId ? await getRuntimeCatalogEntry(decodedGameId) : undefined;
  if (!entry) {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }
  return NextResponse.json(serializeCatalogEntry(entry));
}
