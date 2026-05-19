import { NextResponse } from "next/server";

import { createCatalogRuleSummary } from "@/lib/catalog/rule-summary";
import { getRuntimeCatalogEntry } from "@/lib/catalog/runtime";
import { safeDecodeRouteSegment } from "@/lib/routing/params";
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
    const entry = await getRuntimeCatalogEntry(decodedVariantKey);
    if (!entry) {
      return NextResponse.json({ error: "Unknown game." }, { status: 404 });
    }
    return NextResponse.json(createCatalogRuleSummary(entry));
  }
}
