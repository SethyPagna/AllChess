import { NextResponse } from "next/server";

import { getVariantRuleSummary } from "@/lib/rules-atlas";

export async function GET(_request: Request, { params }: { params: Promise<{ variantKey: string }> }) {
  const { variantKey } = await params;
  try {
    return NextResponse.json(getVariantRuleSummary(variantKey));
  } catch {
    return NextResponse.json({ error: "Unknown variant." }, { status: 404 });
  }
}
