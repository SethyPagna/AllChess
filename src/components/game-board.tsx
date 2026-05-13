"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Brain, Flag, Lightbulb, PlayCircle, RotateCcw, Swords, Undo2 } from "lucide-react";

import { botDifficultyLevels, chooseBotMoveSafe, type BotDifficultyKey } from "@/lib/bots";
import { getTimeControl, timeControls, type TimeControlKey } from "@/lib/time-controls";
import { applyMove, createInitialState, getLegalMoves, sameSquare, serializeSquare, type GameState, type Square } from "@/lib/variants";

const glyphs: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
  g: "王",
  a: "士",
  e: "象",
  h: "馬",
  c: "炮",
  s: "銀",
  l: "香",
  d: "犬",
  w: "狼",
  t: "虎"
};

export function GameBoard({ variantKey, initialState }: { variantKey: string; initialState?: GameState }) {
  const [timeControl, setTimeControl] = useState<TimeControlKey>("rapid");
  const [state, setState] = useState(() => withTimeControl(initialState ?? createInitialState(variantKey), "rapid"));
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyKey>("normal");
  const [autoBot, setAutoBot] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : []), [selected, state]);
  const legalTargets = new Set(legalMoves.map((move) => serializeSquare(move.to)));
  const botColor = state.clocks[1]?.color ?? "black";
  const files = Array.from({ length: state.board[0]?.length ?? 0 }, (_, index) => String.fromCharCode(97 + index));

  function choose(square: Square) {
    if (state.status === "completed") return;
    if (selected && legalTargets.has(serializeSquare(square))) {
      const move = legalMoves.find((candidate) => sameSquare(candidate.to, square));
      if (move) {
        setHistory((current) => [...current, state]);
        setState((current) => applyMove(current, move));
        setSuggestion(null);
        setNotice(null);
      }
      setSelected(null);
      return;
    }

    const cell = state.board[square.row]?.[square.col];
    setSelected(cell?.piece?.owner === state.turn ? square : null);
  }

  function playBotMove(source: "manual" | "auto") {
    const result = chooseBotMoveSafe(state, botDifficulty);
    if (!result.move) {
      setNotice("No legal moves are available. Review the final position or reset the board.");
      setSelected(null);
      return;
    }
    setHistory((current) => [...current, state]);
    setState((current) => applyMove(current, result.move));
    setSuggestion(null);
    setNotice(source === "auto" ? "Bot replied automatically." : "Bot played the current side.");
    setSelected(null);
  }

  function suggestMove() {
    const result = chooseBotMoveSafe(state, botDifficulty);
    if (!result.move) {
      setSuggestion(null);
      setNotice("No legal moves are available.");
      return;
    }
    setSuggestion(
      `${files[result.move.from.col] ?? result.move.from.col}${state.board.length - result.move.from.row} → ${
        files[result.move.to.col] ?? result.move.to.col
      }${state.board.length - result.move.to.row}`
    );
    setNotice(null);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setState(previous);
    setSelected(null);
    setSuggestion(null);
    setNotice(null);
  }

  function reset() {
    setHistory([]);
    setState(withTimeControl(createInitialState(variantKey), timeControl));
    setSelected(null);
    setSuggestion(null);
    setNotice(null);
  }

  function changeTimeControl(nextControl: TimeControlKey) {
    setTimeControl(nextControl);
    setHistory([]);
    setState(withTimeControl(createInitialState(variantKey), nextControl));
    setSelected(null);
    setSuggestion(null);
    setNotice(null);
  }

  useEffect(() => {
    if (!autoBot || state.status !== "active" || state.turn !== botColor) return;
    const timer = window.setTimeout(() => playBotMove("auto"), 450);
    return () => window.clearTimeout(timer);
    // playBotMove is intentionally event-like; state changes drive this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBot, state, botColor, botDifficulty]);

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
              aria-label="Time control"
              className="control px-3 py-2 text-sm font-semibold"
              value={timeControl}
              onChange={(event) => changeTimeControl(event.target.value as TimeControlKey)}
            >
              {timeControls.map((control) => (
                <option key={control.key} value={control.key}>
                  {control.label}
                </option>
              ))}
            </select>
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
            <button type="button" onClick={suggestMove} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">
              <Lightbulb size={16} />
              Suggest
            </button>
            <button type="button" onClick={() => playBotMove("manual")} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">
              <PlayCircle size={16} />
              Move for me
            </button>
            <button
              type="button"
              onClick={() => setAutoBot((current) => !current)}
              className={`focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${
                autoBot ? "bg-[var(--accent)] text-black" : "border border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <Bot size={16} />
              Play AI
            </button>
            <button type="button" onClick={undo} className="focus-ring action-secondary grid h-10 w-10 place-items-center" aria-label="Undo">
              <Undo2 size={17} />
            </button>
            <button type="button" onClick={reset} className="focus-ring action-secondary grid h-10 w-10 place-items-center" aria-label="Reset">
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-[1.75rem_1fr] gap-1">
          <div />
          <div className="grid text-center text-[11px] font-bold uppercase text-[var(--muted)]" style={{ gridTemplateColumns: `repeat(${files.length}, minmax(0, 1fr))` }}>
            {files.map((file) => (
              <span key={file}>{file}</span>
            ))}
          </div>
          <div className="grid text-center text-[11px] font-bold text-[var(--muted)]" style={{ gridTemplateRows: `repeat(${state.board.length}, minmax(0, 1fr))` }}>
            {state.board.map((_, rowIndex) => (
              <span key={rowIndex} className="grid place-items-center">
                {state.board.length - rowIndex}
              </span>
            ))}
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
                    className="focus-ring relative grid min-h-10 place-items-center overflow-hidden text-4xl font-black sm:text-6xl"
                    style={{
                      background: isSelected
                        ? "var(--accent)"
                        : isLegal
                          ? "color-mix(in srgb, var(--accent) 34%, var(--board-light))"
                          : dark
                            ? "var(--board-dark)"
                            : "var(--board-light)",
                      color: isDarkPiece ? "#111917" : "#f8fffb"
                    }}
                  >
                    {cell.terrain && cell.terrain !== "land" ? (
                      <span className="absolute left-1 top-1 text-[9px] font-semibold uppercase opacity-55">{cell.terrain[0]}</span>
                    ) : null}
                    {cell.piece ? (
                      <span className="piece-symbol" data-dark={isDarkPiece}>
                        {glyphs[cell.piece.code] ?? cell.piece.code.toUpperCase()}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
      <aside className="panel grid content-start gap-4 p-4">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">Table</p>
          <p className="text-2xl font-black capitalize">{state.turn} to move</p>
          {suggestion ? <p className="mt-1 text-sm font-bold text-[var(--accent-strong)]">Suggestion: {suggestion}</p> : null}
          {notice ? <p className="mt-1 text-sm text-[var(--warning)]">{notice}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {state.clocks.map((clock) => (
            <div key={clock.color} className="rounded-md border border-[var(--border)] p-3">
              <p className="text-xs uppercase text-[var(--muted)]">{clock.color}</p>
              <p className="font-mono text-xl">{clock.remainingMs > 0 ? `${Math.ceil(clock.remainingMs / 1000)}s` : "∞"}</p>
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

function withTimeControl(state: GameState, key: TimeControlKey): GameState {
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
