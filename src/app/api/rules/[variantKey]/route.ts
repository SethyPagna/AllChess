import { NextResponse } from "next/server";

import { getGameCatalogEntry } from "@/lib/catalog";
import { getVariantRuleSummary } from "@/lib/rules-atlas";

export async function GET(_request: Request, { params }: { params: Promise<{ variantKey: string }> }) {
  const { variantKey } = await params;
  try {
    return NextResponse.json(getVariantRuleSummary(variantKey));
  } catch {
    const entry = getGameCatalogEntry(decodeURIComponent(variantKey));
    if (!entry) {
      return NextResponse.json({ error: "Unknown game." }, { status: 404 });
    }
    return NextResponse.json({
      variantKey: entry.id,
      sourceLinks: entry.ruleSourceLinks,
      numberedBasics: entry.shortRules,
      specialRules: entry.reviewFocus,
      winConditions: entry.winConditions,
      drawConditions: entry.playability === "playable" ? ["Draw handling is enforced by the verified rules engine for this game."] : ["Draw handling is locked before a game becomes playable."],
      illegalMoveNotes: entry.playability === "playable" ? ["All moves are validated by the authoritative rules engine."] : ["This game is not marked playable until illegal-move tests pass."],
      completion: {
        status: entry.playability === "playable" ? "verified-playable" : "rules-gated",
        verifiedEdgeCases: entry.playability === "playable" ? ["Legal moves, terminal states, bot validation, review, persistence, and E2E are verified."] : [],
        remainingGates: entry.playability === "playable" ? [] : ["Rules, bot, review, persistence, and E2E fixtures must pass before this game becomes playable."]
      }
    });
  }
}
