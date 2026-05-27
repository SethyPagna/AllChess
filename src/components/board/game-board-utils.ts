import { getTimeControl, type TimeControlKey } from "@/lib/game/time-controls";
import { getLegalMoves, sameSquare, type GameState, type Square } from "@/lib/variants";

type SeatChoice = "random" | "first" | "second";

export function withTimeControl(state: GameState, key: TimeControlKey): GameState {
  const control = getTimeControl(key);
  return {
    ...state,
    clocks: state.clocks.map((clock) => ({
      ...clock,
      remainingMs: control.baseSeconds * 1000,
      incrementMs: control.incrementSeconds * 1000
    }))
  };
}

export function pickHumanColor(state: GameState, choice: SeatChoice) {
  const first = state.clocks[0]?.color ?? "white";
  const second = state.clocks[1]?.color ?? "black";
  if (choice === "first") return first;
  if (choice === "second") return second;
  return Math.random() > 0.5 ? first : second;
}

export function colorLabel(color: string) {
  const labels: Record<string, string> = {
    black: "Black",
    blue: "Blue",
    gote: "Gote",
    red: "Red",
    sente: "Sente",
    white: "White"
  };
  return labels[color] ?? color;
}

export function formatMove(from: Square, to: Square, files: string[], rows: number) {
  return `${squareName(from, files, rows)} to ${squareName(to, files, rows)}`;
}

export function squareName(square: Square, files: string[], rows: number) {
  return `${files[square.col] ?? square.col}${rows - square.row}`;
}

export function quickSuggestionMove(state: GameState) {
  if (state.variantKey !== "classic" || state.moves.length > 2) return null;
  const preferredMoves = state.turn === "white" ? ["e2e4", "d2d4", "g1f3"] : ["e7e5", "d7d5", "g8f6"];

  for (const uci of preferredMoves) {
    const from = uciSquare(uci.slice(0, 2));
    const to = uciSquare(uci.slice(2, 4));
    const move = getLegalMoves(state, from).find((candidate) => sameSquare(candidate.to, to));
    if (move) return move;
  }

  return null;
}

export function pieceName(code: string) {
  const names: Record<string, string> = {
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
    g: "general",
    a: "advisor",
    e: "elephant",
    h: "horse",
    c: "cannon",
    s: "silver",
    l: "lance",
    d: "dog",
    w: "wolf",
    t: "tiger"
  };
  return names[code] ?? code;
}

function uciSquare(square: string): Square {
  return {
    row: 8 - Number(square[1]),
    col: square.charCodeAt(0) - 97
  };
}
