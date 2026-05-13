"use client";

import { useMemo, useState } from "react";
import { Bot, Brain, Flag, RotateCcw, Swords, Undo2 } from "lucide-react";

import { botDifficultyLevels, chooseBotMove, type BotDifficultyKey } from "@/lib/bots";
import { applyMove, createInitialState, getLegalMoves, sameSquare, serializeSquare, type GameState, type Square } from "@/lib/variants";

const glyphs: Record<string, string> = {
  k: "♔",
  q: "♕",
  r: "♖",
  b: "♗",
  n: "♘",
  p: "♙",
  g: "王",
  a: "士",
  e: "象",
  h: "馬",
  c: "砲",
  s: "銀",
  l: "香",
  d: "狗",
  w: "狼",
  t: "虎"
};

export function GameBoard({ variantKey, initialState }: { variantKey: string; initialState?: GameState }) {
  const [state, setState] = useState(() => initialState ?? createInitialState(variantKey));
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyKey>("normal");
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : []), [selected, state]);
  const legalTargets = new Set(legalMoves.map((move) => serializeSquare(move.to)));

  function choose(square: Square) {
    if (selected && legalTargets.has(serializeSquare(square))) {
      const move = legalMoves.find((candidate) => sameSquare(candidate.to, square));
      if (move) {
        setHistory((current) => [...current, state]);
        setState((current) => applyMove(current, move));
      }
      setSelected(null);
      return;
    }

    const cell = state.board[square.row]?.[square.col];
    setSelected(cell?.piece?.owner === state.turn ? square : null);
  }

  function askBot() {
    const move = chooseBotMove(state, botDifficulty);
    setHistory((current) => [...current, state]);
    setState((current) => applyMove(current, move));
    setSelected(null);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setState(previous);
    setSelected(null);
  }

  function reset() {
    setHistory([]);
    setState(createInitialState(variantKey));
    setSelected(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,760px)_minmax(280px,380px)]">
      <div className="grid gap-3">
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2">
            <Swords size={18} className="text-[var(--accent)]" />
            <span className="text-sm font-bold capitalize">{state.turn}</span>
            <span className="text-xs text-[var(--muted)]">{state.status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Bot difficulty"
              className="control px-3 py-2 text-sm font-semibold"
              value={botDifficulty}
              onChange={(event) => setBotDifficulty(event.target.value as BotDifficultyKey)}
            >
              {botDifficultyLevels.map((level) => (
                <option key={level.key} value={level.key}>
                  {level.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={askBot} className="focus-ring action-primary inline-flex items-center gap-2 px-3 py-2 text-sm">
              <Bot size={16} />
              Bot move
            </button>
            <button type="button" onClick={undo} className="focus-ring action-secondary grid h-10 w-10 place-items-center" aria-label="Undo">
              <Undo2 size={17} />
            </button>
            <button type="button" onClick={reset} className="focus-ring action-secondary grid h-10 w-10 place-items-center" aria-label="Reset">
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
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
              const isDarkPiece = cell.piece?.owner === "black" || cell.piece?.owner === "blue" || cell.piece?.owner === "gote";
              return (
                <button
                  type="button"
                  key={serializeSquare(cell.square)}
                  onClick={() => choose(cell.square)}
                  className="focus-ring relative grid min-h-10 place-items-center text-2xl font-black sm:text-4xl"
                  style={{
                    background: isSelected
                      ? "var(--accent)"
                      : isLegal
                        ? "color-mix(in srgb, var(--accent) 34%, var(--board-light))"
                        : dark
                          ? "var(--board-dark)"
                          : "var(--board-light)",
                    color: isDarkPiece ? "#101715" : "#f9fffb"
                  }}
                >
                  {cell.terrain && cell.terrain !== "land" ? (
                    <span className="absolute left-1 top-1 text-[9px] font-semibold uppercase opacity-55">{cell.terrain[0]}</span>
                  ) : null}
                  {cell.piece ? (
                    <span
                      className="grid h-[74%] w-[74%] place-items-center rounded-full border shadow-md"
                      style={{
                        background: isDarkPiece ? "#17201d" : "#fbfdfb",
                        borderColor: isDarkPiece ? "#101715" : "#c9d6cf",
                        color: isDarkPiece ? "#f3f8f5" : "#17201d"
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
      </div>
      <aside className="panel grid content-start gap-4 p-4">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">Table</p>
          <p className="text-2xl font-black capitalize">{state.turn} to move</p>
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
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Brain size={16} className="text-[var(--accent)]" />
            Moves
          </p>
          <ol className="max-h-56 space-y-1 overflow-auto text-sm text-[var(--muted)]">
            {state.moves.length ? state.moves.map((move, index) => <li key={`${move.notation}-${index}`}>{index + 1}. {move.notation}</li>) : <li>No moves yet.</li>}
          </ol>
        </div>
        <div className="rounded-md bg-[var(--surface-strong)] p-3 text-sm text-[var(--muted)]">
          <p className="mb-1 flex items-center gap-2 font-bold text-[var(--foreground)]">
            <Flag size={16} className="text-[var(--warning)]" />
            Review hook
          </p>
          Every move stays local in demo mode and is ready for D1 persistence when deployed.
        </div>
      </aside>
    </div>
  );
}
