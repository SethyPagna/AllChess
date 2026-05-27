import type { GameCatalogEntry } from "@/lib/catalog";

export function createCatalogRuleSummary(entry: GameCatalogEntry) {
  return {
    variantKey: entry.id,
    sourceLinks: entry.ruleSourceLinks,
    numberedBasics: entry.shortRules,
    specialRules: entry.reviewFocus,
    winConditions: entry.winConditions,
    drawConditions:
      entry.playability === "playable"
        ? ["Draw handling is enforced by the verified rules engine for this game."]
        : ["Draw handling is locked before a game becomes playable."],
    illegalMoveNotes:
      entry.playability === "playable"
        ? ["All moves are validated by the authoritative rules engine."]
        : ["This game is not marked playable until illegal-move tests pass."],
    completion: {
      status: entry.playability === "playable" ? "verified-playable" : "rules-gated",
      verifiedEdgeCases: entry.playability === "playable" ? ["Legal moves, terminal states, bot validation, review, persistence, and E2E are verified."] : [],
      remainingGates: entry.playability === "playable" ? [] : ["Rules, bot, review, persistence, and E2E fixtures must pass before this game becomes playable."]
    }
  };
}
