"use client";

import { useMemo, useState } from "react";

import { applyMove, createInitialState, getLegalMoves, sameSquare, serializeSquare, type GameState, type Square } from "@/lib/variants";

const glyphs: Record<string, string> = {
  k: "K",
  q: "Q",
  r: "R",
  b: "B",
  n: "N",
  p: "P",
  g: "G",
  a: "A",
  e: "E",
  h: "H",
  c: "C",
  s: "S",
  l: "L",
  d: "D",
  w: "W",
  t: "T"
};

export function GameBoard({ variantKey, initialState }: { variantKey: string; initialState?: GameState }) {
  const [state, setState] = useState(() => initialState ?? createInitialState(variantKey));
  const [selected, setSelected] = useState<Square | null>(null);
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : []), [selected, state]);
  const legalTargets = new Set(legalMoves.map((move) => serializeSquare(move.to)));

  function choose(square: Square) {
    if (selected && legalTargets.has(serializeSquare(square))) {
      const move = legalMoves.find((candidate) => sameSquare(candidate.to, square));
      if (move) setState((current) => applyMove(current, move));
      setSelected(null);
      return;
    }

    const cell = state.board[square.row]?.[square.col];
    setSelected(cell?.piece?.owner === state.turn ? square : null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,680px)_minmax(240px,1fr)]">
      <div
        className="grid overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl"
        style={{
          gridTemplateColumns: `repeat(${state.board[0]?.length ?? 8}, minmax(0, 1fr))`,
          aspectRatio: `${state.board[0]?.length ?? 8} / ${state.board.length}`
        }}
        aria-label="Game board"
      >
        {state.board.flatMap((row) =>
          row.map((cell) => {
            const isSelected = selected && sameSquare(selected, cell.square);
            const isLegal = legalTargets.has(serializeSquare(cell.square));
            const dark = (cell.square.row + cell.square.col) % 2 === 1;
            return (
              <button
                type="button"
                key={serializeSquare(cell.square)}
                onClick={() => choose(cell.square)}
                className="focus-ring relative grid min-h-10 place-items-center text-xl font-black sm:text-3xl"
                style={{
                  background: isSelected
                    ? "var(--accent)"
                    : isLegal
                      ? "color-mix(in srgb, var(--accent) 34%, var(--board-light))"
                      : dark
                        ? "var(--board-dark)"
                        : "var(--board-light)",
                  color: cell.piece?.owner === "black" || cell.piece?.owner === "blue" || cell.piece?.owner === "gote" ? "#18130f" : "#fffaf0"
                }}
              >
                {cell.terrain && cell.terrain !== "land" ? (
                  <span className="absolute left-1 top-1 text-[9px] font-semibold uppercase opacity-55">{cell.terrain[0]}</span>
                ) : null}
                {cell.piece ? (
                  <span
                    className="grid h-[70%] w-[70%] place-items-center rounded-full border border-black/25 shadow-md"
                    style={{
                      background:
                        cell.piece.owner === "white" || cell.piece.owner === "red" || cell.piece.owner === "sente"
                          ? "#f8f0df"
                          : "#2b2520",
                      color:
                        cell.piece.owner === "white" || cell.piece.owner === "red" || cell.piece.owner === "sente"
                          ? "#1b1712"
                          : "#f7ead4"
                    }}
                  >
                    {glyphs[cell.piece.code] ?? cell.piece.code.toUpperCase()}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
      <aside className="panel grid content-start gap-4 p-4">
        <div>
          <p className="text-sm text-[var(--muted)]">Turn</p>
          <p className="text-2xl font-black capitalize">{state.turn}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {state.clocks.map((clock) => (
            <div key={clock.color} className="rounded-md border border-[var(--border)] p-3">
              <p className="text-xs uppercase text-[var(--muted)]">{clock.color}</p>
              <p className="font-mono text-xl">{Math.ceil(clock.remainingMs / 1000)}s</p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">Moves</p>
          <ol className="max-h-56 space-y-1 overflow-auto text-sm text-[var(--muted)]">
            {state.moves.length ? state.moves.map((move, index) => <li key={`${move.notation}-${index}`}>{index + 1}. {move.notation}</li>) : <li>No moves yet.</li>}
          </ol>
        </div>
      </aside>
    </div>
  );
}
