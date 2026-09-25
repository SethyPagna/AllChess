import { applyMove, getLegalMoves, type GameState } from "@/lib/variants";
import { applyOukCountAction, getOukCountChoices, withOukBotCount } from "@/lib/variants/ouk-counting";

/** Check a small, eligible endgame before making a draw claim that would forfeit a mate. */
export function prepareOukBotTurn(state: GameState): GameState {
  if (state.variantKey !== "ouk-chaktrang" || state.status !== "active") return state;
  const choices = getOukCountChoices(state, state.turn);
  if (!choices.board && !choices.pieces && !choices.stop) return state;
  const uncounted = choices.stop ? applyOukCountAction(state, state.turn, "stop") : state;
  for (const row of uncounted.board) for (const cell of row) {
    if (cell.piece?.owner !== state.turn) continue;
    for (const move of getLegalMoves(uncounted, cell.square)) {
      const next = applyMove(uncounted, move);
      if (next.status === "completed" && next.result === state.turn) return uncounted;
    }
  }
  return withOukBotCount(state);
}
