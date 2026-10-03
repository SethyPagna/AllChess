import { applyMove, getLegalMoves, type GameState } from "@/lib/variants";
import { applyMakrukCountAction, getMakrukCountChoices, withMakrukBotCount } from "@/lib/variants/makruk-counting";

/** Do not turn a mating move into a draw by retaining or starting a board count. */
export function prepareMakrukBotTurn(state: GameState): GameState {
  const choices = getMakrukCountChoices(state, state.turn);
  if (!choices.board && !choices.stop) return state;
  const uncounted = choices.stop ? applyMakrukCountAction(state, state.turn, "stop") : state;
  for (const row of uncounted.board) for (const cell of row) {
    if (cell.piece?.owner !== state.turn) continue;
    for (const move of getLegalMoves(uncounted, cell.square)) {
      const next = applyMove(uncounted, move);
      if (next.status === "completed" && next.result === state.turn) return uncounted;
    }
  }
  return withMakrukBotCount(state);
}
