export function getDropRuleNote(variantKey: string, pieceCode: string) {
  if (variantKey === "crazyhouse") {
    return pieceCode === "p" ? "Pawns cannot drop on the first or last rank." : "Drops must land on empty legal squares.";
  }

  if (variantKey === "shogi" || variantKey === "mini-shogi") {
    if (pieceCode === "p") return "Nifu, dead-rank, check, and pawn-drop mate rules are checked.";
    if (pieceCode === "l" || pieceCode === "n") return "Dead-rank drops and self-check are checked.";
    return "Drops must land on empty squares without leaving check.";
  }

  return "Drops must land on legal empty squares.";
}

export function getHandPieceHelpText({
  canUseHand,
  pieceLabel,
  pieceCode,
  variantKey
}: {
  canUseHand: boolean;
  pieceLabel: string;
  pieceCode: string;
  variantKey: string;
}) {
  const ruleNote = getDropRuleNote(variantKey, pieceCode);
  return canUseHand ? `Tap or drag ${pieceLabel} to a legal empty square. ${ruleNote}` : `${pieceLabel} is in hand. Start or resume your turn to drop it. ${ruleNote}`;
}
