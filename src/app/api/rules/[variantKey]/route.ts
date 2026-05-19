import { NextResponse } from "next/server";

import { getD1CatalogEntry } from "@/lib/cloudflare/d1-catalog";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { createCatalogRuleSummary } from "@/lib/catalog/rule-summary";
import { safeDecodeRouteSegment } from "@/lib/routing/params";
import { getGameCatalogEntry } from "@/lib/catalog";
import { getVariantRuleSummary } from "@/lib/rules-atlas";

export async function GET(_request: Request, { params }: { params: Promise<{ variantKey: string }> }) {
  const { variantKey } = await params;
  const decodedVariantKey = safeDecodeRouteSegment(variantKey);
  if (!decodedVariantKey) {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }

  try {
    return NextResponse.json(getVariantRuleSummary(decodedVariantKey));
  } catch {
    const d1Entry = await getD1BackedCatalogEntry(decodedVariantKey);
    if (d1Entry) {
      return NextResponse.json(createCatalogRuleSummary(d1Entry));
    }

    const entry = getGameCatalogEntry(decodedVariantKey);
    if (!entry) {
      return NextResponse.json({ error: "Unknown game." }, { status: 404 });
    }
    return NextResponse.json(createCatalogRuleSummary(entry));
  }
}

async function getD1BackedCatalogEntry(gameId: string) {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) return null;
  try {
    return await getD1CatalogEntry(env.ALLCHESS_D1, gameId);
  } catch {
    return null;
  }
}
