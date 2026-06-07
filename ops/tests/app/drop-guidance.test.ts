import { describe, expect, test } from "vitest";

import { getDropRuleNote, getHandPieceHelpText } from "@/components/board/drop-guidance";

describe("drop guidance", () => {
  test("describes shogi pawn-specific drop restrictions", () => {
    expect(getDropRuleNote("shogi", "p")).toBe("Nifu, dead-rank, check, and pawn-drop mate rules are checked.");
  });

  test("describes crazyhouse pawn rank limits", () => {
    expect(getDropRuleNote("crazyhouse", "p")).toBe("Pawns cannot drop on the first or last rank.");
  });

  test("adds variant drop rules to hand-piece help text", () => {
    expect(getHandPieceHelpText({ canUseHand: true, pieceLabel: "Pawn", pieceCode: "p", variantKey: "mini-shogi" })).toContain("Nifu");
    expect(getHandPieceHelpText({ canUseHand: false, pieceLabel: "Pawn", pieceCode: "p", variantKey: "crazyhouse" })).toContain("Start or resume your turn");
  });
});
