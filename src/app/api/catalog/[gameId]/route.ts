import { NextResponse } from "next/server";

import { getGameCatalogEntry, serializeCatalogEntry } from "@/lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const entry = getGameCatalogEntry(decodeURIComponent(gameId));
  if (!entry) {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }
  return NextResponse.json(serializeCatalogEntry(entry));
}
