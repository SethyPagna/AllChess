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
  "no-legal-moves": "no legal moves",
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
    "no-legal-moves": "The side to move has no legal move; this variant scores that as a loss rather than a draw.",
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
