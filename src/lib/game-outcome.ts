import { getVariant, type GameState, type PlayerColor } from "@/lib/variants";

export type GameOutcome = {
  winner: PlayerColor | null;
  result: "win" | "loss" | "draw";
  reason: NonNullable<GameState["outcomeReason"]>;
  headline: string;
  detail: string;
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

  if (result === "draw") {
    return {
      winner,
      result,
      reason,
      headline: `Draw by ${label}`,
      detail: `${variant.objective} The game is complete after ${state.ply} ply.`,
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
    detail: `${capitalize(String(winner))} is the winner. ${variant.objective}`,
    completedAtPly: state.ply,
    celebrate: result === "win"
  };
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
