import { getVariant, type GameState, type PlayerColor } from "@/lib/variants";

export type GameOutcome = {
  winner: PlayerColor | null;
  result: "win" | "loss" | "draw";
  reason: NonNullable<GameState["outcomeReason"]>;
  headline: string;
  detail: string;
  context: string[];
  completedAtPly: number;
  celebrate: boolean;
};

const reasonLabels: Record<NonNullable<GameState["outcomeReason"]>, string> = {
  checkmate: "checkmate",
  stalemate: "stalemate",
  timeout: "time",
  "three-check": "three checks",
  objective: "variant objective",
  "royal-captured": "royal capture",
  "lost-all-pieces": "lost all pieces",
  "no-legal-moves": "no legal moves",
  "insufficient-material": "insufficient material",
  "fifty-move": "fifty-move rule",
  draw: "draw"
};

export function describeGameOutcome(state: GameState, viewer: PlayerColor = state.clocks[0]?.color ?? "white"): GameOutcome | null {
  if (state.status !== "completed") return null;

  const winner = state.result && state.result !== "draw" ? state.result : null;
  const reason = state.outcomeReason ?? inferOutcomeReason(state);
  const result: GameOutcome["result"] = !winner ? "draw" : winner === viewer ? "win" : "loss";
  const label = reasonLabels[reason];
  const variant = getVariant(state.variantKey);
  const context = outcomeContext(state, reason, result, winner);

  if (result === "draw") {
    return {
      winner,
      result,
      reason,
      headline: `Draw by ${label}`,
      detail: `${variant.objective} The game ended after ${state.ply} ply.`,
      context,
      completedAtPly: state.ply,
      celebrate: false
    };
  }

  const perspective = result === "win" ? "won" : "lost";
  const suffix = reason === "timeout" ? "on time" : `by ${label}`;
  return {
    winner,
    result,
    reason,
    headline: `You ${perspective} ${suffix}`,
    detail: `${capitalize(String(winner))} is the winner after ${state.ply} ply. ${variant.objective}`,
    context,
    completedAtPly: state.ply,
    celebrate: result === "win"
  };
}

function outcomeContext(state: GameState, reason: NonNullable<GameState["outcomeReason"]>, result: GameOutcome["result"], winner: PlayerColor | null) {
  const sideToMove = capitalize(String(state.turn));
  const winnerText = winner ? capitalize(String(winner)) : null;
  const base =
    result === "draw"
      ? "No player receives the win for this finished position."
      : `${winnerText} receives the win; the other side cannot continue under this ruleset.`;

  const reasonText: Record<NonNullable<GameState["outcomeReason"]>, string> = {
    checkmate: "The royal piece is in check, and every escape, capture, or block is illegal.",
    stalemate: "The side to move has no legal move, but is not currently in check, so standard chess rules score it as a draw.",
    timeout: "The clock reached zero before the side to move completed a legal move.",
    "three-check": "A player delivered the third check before any other ending overrode it.",
    objective: "A variant-specific objective was reached before normal checkmate or draw rules decided the game.",
    "royal-captured": "This ruleset allows the royal piece to be captured, so capture immediately decides the result.",
    "lost-all-pieces": "In Antichess, successfully losing every piece wins the game.",
    "no-legal-moves": "The side to move has no legal move; this variant-specific ending is applied instead of standard stalemate.",
    "insufficient-material": "Neither side has enough material left to force checkmate. With only the two kings, the game is immediately drawn.",
    "fifty-move": "Fifty full moves passed without a pawn move or capture, so standard chess rules allow the game to be drawn.",
    draw: "The selected ruleset reached a drawn result with no winner."
  };

  return [reasonText[reason], `${sideToMove} was the side to move when the game ended.`, base];
}

function inferOutcomeReason(state: GameState): NonNullable<GameState["outcomeReason"]> {
  if (state.result === "draw") return "draw";
  if (state.variantKey === "king-of-the-hill") return "objective";
  if (state.variantKey === "three-check") return "three-check";
  return "checkmate";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
