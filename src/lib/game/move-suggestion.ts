import { formatMoveNotation } from "./notation";
import { findLegalMove, type GameState, type Move } from "@/lib/variants";

export type MoveSuggestion = Move & {
  gameId: string;
  ply: number;
  notation: string;
  score: number | null;
  depthReached: number;
};

export function createMoveSuggestion(state: GameState, move: Move, score: number | null = null, depthReached = 0): MoveSuggestion {
  return { ...move, gameId: state.id, ply: state.ply, notation: formatMoveNotation(state, move), score, depthReached };
}

export function resolveMoveSuggestion(state: GameState, suggestion: MoveSuggestion): Move | null {
  if (state.id !== suggestion.gameId || state.ply !== suggestion.ply) return null;
  return findLegalMove(state, suggestion);
}

export function suggestionSelection(move: Move) {
  return {
    square: move.kind === "drop" || move.kind === "pass" ? null : move.from,
    handCode: move.kind === "drop" ? move.drop?.code ?? null : null
  };
}
