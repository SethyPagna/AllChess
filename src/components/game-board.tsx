"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bot,
  Brain,
  Crown,
  Dices,
  Flag,
  GraduationCap,
  Handshake,
  Lightbulb,
  Medal,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Timer,
  Undo2,
  Zap
} from "lucide-react";

import { botDifficultyLevels, cancelBotMove, requestBotMove, type BotDifficultyKey, type BotMoveResult } from "@/lib/bots";
import { formatClock, tickGameClock } from "@/lib/clocks";
import { analyzeMoveList, summarizeReview } from "@/lib/game-review";
import { describeGameOutcome } from "@/lib/game-outcome";
import { getTimeControl, timeControls, type TimeControlKey } from "@/lib/time-controls";
import { applyMove, createInitialState, getLegalMoves, sameSquare, serializeSquare, type GameState, type Square } from "@/lib/variants";
import { PieceIcon } from "@/components/piece-icon";

type BotMode = "human" | "opponent" | "both";

type ThinkingState = {
  status: "idle" | "thinking" | "cancelled" | "failed";
  label: string;
};

type SuggestedMove = {
  from: Square;
  to: Square;
  notation: string;
  score: number | null;
  depthReached: number;
};

type PlayCardKey = "online" | "bots" | "coach" | "friend" | "tournaments" | "variants";

export function GameBoard({ variantKey, initialState }: { variantKey: string; initialState?: GameState }) {
  const [timeControl, setTimeControl] = useState<TimeControlKey>("rapid");
  const [state, setState] = useState(() => withTimeControl(initialState ?? createInitialState(variantKey), "rapid"));
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyKey>("normal");
  const [botMode, setBotMode] = useState<BotMode>("human");
  const [thinking, setThinking] = useState<ThinkingState>({ status: "idle", label: "" });
  const [suggestedMove, setSuggestedMove] = useState<SuggestedMove | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(true);
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const activeBotRequestRef = useRef<string | null>(null);

  const timeline = useMemo(() => (history.length ? [...history, state] : [state]), [history, state]);
  const reviewMoves = useMemo(() => analyzeMoveList(state.moves), [state.moves]);
  const reviewSummary = useMemo(() => summarizeReview(reviewMoves), [reviewMoves]);
  const displayPly = reviewPly ?? timeline.length - 1;
  const displayState = timeline[Math.min(displayPly, timeline.length - 1)] ?? state;
  const activeReviewMove = displayPly > 0 ? reviewMoves[displayPly - 1] : null;
  const isReviewing = reviewPly !== null;
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : []), [selected, state]);
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => serializeSquare(move.to))), [legalMoves]);
  const botColor = state.clocks[1]?.color ?? "black";
  const rows = displayState.board.length;
  const cols = displayState.board[0]?.length ?? 8;
  const files = useMemo(() => Array.from({ length: cols }, (_, index) => String.fromCharCode(97 + index)), [cols]);
  const botLevel = botDifficultyLevels.find((level) => level.key === botDifficulty) ?? botDifficultyLevels[1];
  const outcome = useMemo(() => describeGameOutcome(state, "white"), [state]);
  const playCards: Array<{ key: PlayCardKey; label: string; description: string; Icon: typeof Zap }> = [
    { key: "online", label: "Play Online", description: "Open the lobby for live rooms and pairing.", Icon: Zap },
    { key: "bots", label: "Play Bots", description: "Practice against Easy through Legend tiers.", Icon: Bot },
    { key: "coach", label: "Play Coach", description: "Get a suggestion or review the current game.", Icon: GraduationCap },
    { key: "friend", label: "Play a Friend", description: "Prepare a private room invite.", Icon: Handshake },
    { key: "tournaments", label: "Tournaments", description: "See arena status for scheduled brackets.", Icon: Medal },
    { key: "variants", label: "Chess Variants", description: "Classic, Xiangqi, Shogi, Makruk, Jungle, and more.", Icon: Dices }
  ];

  async function runPlayCardAction(action: PlayCardKey) {
    if (action === "online") {
      navigateToSibling("lobby");
      return;
    }
    if (action === "variants") {
      navigateToSibling("variants");
      return;
    }
    if (action === "bots") {
      setBotMode("opponent");
      setNotice("Bot opponent is on. Make a move and the bot will reply automatically.");
      return;
    }
    if (action === "coach") {
      if (reviewMoves.length) {
        startReview();
        return;
      }
      await suggestMove();
      return;
    }
    if (action === "friend") {
      setNotice("Friend rooms use the room service when online deployment is connected. For now, use the lobby room controls.");
      return;
    }
    setNotice("Tournament brackets will appear here when arena scheduling is connected.");
  }

  function choose(square: Square) {
    if (isReviewing) {
      setNotice("Review mode is showing a saved position. Jump to live to keep playing.");
      return;
    }
    if (state.status === "completed" || thinking.status === "thinking") return;
    if (selected && legalTargets.has(serializeSquare(square))) {
      const move = legalMoves.find((candidate) => sameSquare(candidate.to, square));
      if (move) {
        setHistory((current) => [...current, state]);
        setState((current) => applyMove(current, move));
        setSuggestedMove(null);
        setNotice(null);
        setReviewPly(null);
        setReviewPlaying(false);
      }
      setSelected(null);
      return;
    }

    const cell = state.board[square.row]?.[square.col];
    setSelected(cell?.piece?.owner === state.turn ? square : null);
  }

  const finishBotRequest = useCallback(
    (snapshot: GameState, result: BotMoveResult, source: "manual" | "auto") => {
      if (activeBotRequestRef.current !== result.requestId) return;
      activeBotRequestRef.current = null;
      setThinking({ status: "idle", label: "" });

      if (result.status === "cancelled") {
        setNotice("Bot thinking was cancelled.");
        return;
      }

      if (!result.move) {
        setNotice(result.status === "no-legal-moves" ? "No legal moves are available. Review the final position or reset the board." : result.error ?? "Bot move failed.");
        return;
      }

      const move = result.move;
      setHistory((current) => [...current, snapshot]);
      setState((current) => {
        if (current.id !== snapshot.id || current.ply !== snapshot.ply || current.turn !== snapshot.turn) return current;
        return applyMove(current, move);
      });
      setSuggestedMove(null);
      setNotice(source === "auto" ? "Bot replied automatically." : "Bot played the current side.");
      setSelected(null);
      setReviewPly(null);
      setReviewPlaying(false);
    },
    []
  );

  const playBotMove = useCallback(
    async (source: "manual" | "auto", snapshot = state) => {
      if (snapshot.status !== "active" || activeBotRequestRef.current) return;
      const requestId = crypto.randomUUID();
      activeBotRequestRef.current = requestId;
      setThinking({ status: "thinking", label: source === "auto" ? "Bot is replying..." : "Bot is thinking..." });
      setNotice(null);

      const result = await requestBotMove(snapshot, botDifficulty, {
        requestId,
        delayMs: source === "auto" ? 180 : 0,
        maxSearchTimeMs: Math.min(botLevel.moveTimeMs, source === "auto" ? 900 : 1200)
      });
      finishBotRequest(snapshot, result, source);
    },
    [botDifficulty, botLevel.moveTimeMs, finishBotRequest, state]
  );

  async function suggestMove() {
    if (state.status !== "active" || activeBotRequestRef.current || isReviewing) return;
    const requestId = crypto.randomUUID();
    activeBotRequestRef.current = requestId;
    setThinking({ status: "thinking", label: "Finding a suggestion..." });
    setNotice(null);

    const result = await requestBotMove(state, botDifficulty, { requestId, maxSearchTimeMs: Math.min(botLevel.moveTimeMs, 650) });
    if (activeBotRequestRef.current !== requestId) return;
    activeBotRequestRef.current = null;
    setThinking({ status: "idle", label: "" });

    if (!result.move) {
      setSuggestedMove(null);
      setNotice("No legal moves are available.");
      return;
    }

    setSuggestedMove({
      from: result.move.from,
      to: result.move.to,
      notation: formatMove(result.move.from, result.move.to, files, rows),
      score: result.score,
      depthReached: result.depthReached
    });
    setSelected(result.move.from);
    setNotice(null);
  }

  function applySuggestion() {
    if (!suggestedMove) return;
    const move = getLegalMoves(state, suggestedMove.from).find((candidate) => sameSquare(candidate.to, suggestedMove.to));
    if (!move) {
      setNotice("That suggestion is no longer legal.");
      setSuggestedMove(null);
      return;
    }
    setHistory((current) => [...current, state]);
    setState((current) => applyMove(current, move));
    setSelected(null);
    setSuggestedMove(null);
    setNotice("Suggestion applied.");
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function cancelThinking() {
    const requestId = activeBotRequestRef.current;
    if (!requestId) return;
    cancelBotMove(requestId);
    activeBotRequestRef.current = null;
    setThinking({ status: "cancelled", label: "Cancelled" });
    setNotice("Bot thinking was cancelled.");
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setState(previous);
    setSelected(null);
    setSuggestedMove(null);
    setNotice(null);
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function reset() {
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelBotMove(requestId);
    activeBotRequestRef.current = null;
    setHistory([]);
    setState(withTimeControl(createInitialState(variantKey), timeControl));
    setSelected(null);
    setSuggestedMove(null);
    setNotice(null);
    setThinking({ status: "idle", label: "" });
    setShowOutcome(true);
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function changeTimeControl(nextControl: TimeControlKey) {
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelBotMove(requestId);
    activeBotRequestRef.current = null;
    setTimeControl(nextControl);
    setHistory([]);
    setState(withTimeControl(createInitialState(variantKey), nextControl));
    setSelected(null);
    setSuggestedMove(null);
    setNotice(null);
    setThinking({ status: "idle", label: "" });
    setShowOutcome(true);
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function startReview() {
    setReviewPly(0);
    setReviewPlaying(false);
    setSelected(null);
    setSuggestedMove(null);
    setNotice("Review mode opened. Use playback controls to inspect each position.");
  }

  function jumpToLive() {
    setReviewPly(null);
    setReviewPlaying(false);
    setNotice("Back to live board.");
  }

  function setReviewCursor(nextPly: number) {
    setReviewPly(Math.max(0, Math.min(nextPly, timeline.length - 1)));
    setReviewPlaying(false);
    setSelected(null);
  }

  useEffect(() => {
    if (isReviewing || state.status !== "active" || thinking.status === "thinking") return;
    const shouldMove = botMode === "both" || (botMode === "opponent" && state.turn === botColor);
    if (!shouldMove) return;
    const snapshot = state;
    const timer = window.setTimeout(() => {
      void playBotMove("auto", snapshot);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [botColor, botMode, isReviewing, playBotMove, state, thinking.status]);

  useEffect(() => {
    if (!reviewPlaying) return;
    const timer = window.setInterval(() => {
      setReviewPly((current) => {
        const next = Math.min((current ?? 0) + 1, timeline.length - 1);
        if (next >= timeline.length - 1) {
          window.setTimeout(() => setReviewPlaying(false), 0);
        }
        return next;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [reviewPlaying, timeline.length]);

  useEffect(() => {
    let lastTick = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTick;
      lastTick = now;
      setState((current) => tickGameClock(current, elapsed));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="game-board-layout grid gap-4">
      <div className="grid gap-3">
        <div className="board-shell" data-variant-size={`${cols}x${rows}`} style={{ "--board-cols": cols, "--board-rows": rows } as CSSProperties}>
          <div className="board-stage">
            <div className="board-grid overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-label="Game board">
              {displayState.board.flatMap((row) =>
                row.map((cell) => {
                  const isSelected = selected && sameSquare(selected, cell.square);
                  const isLegal = legalTargets.has(serializeSquare(cell.square));
                  const isSuggestedFrom = suggestedMove && sameSquare(suggestedMove.from, cell.square);
                  const isSuggestedTo = suggestedMove && sameSquare(suggestedMove.to, cell.square);
                  const dark = (cell.square.row + cell.square.col) % 2 === 1;
                  const isDarkPiece = cell.piece?.owner === "black" || cell.piece?.owner === "blue" || cell.piece?.owner === "gote";
                  const name = squareName(cell.square, files, rows);
                  return (
                    <button
                      type="button"
                      key={serializeSquare(cell.square)}
                      onClick={() => choose(cell.square)}
                      className="board-square focus-ring relative grid place-items-center overflow-hidden font-black"
                      aria-label={cell.piece ? `${name} ${cell.piece.owner} ${pieceName(cell.piece.code)}` : name}
                      data-square={name}
                      data-suggested={isSuggestedFrom ? "from" : isSuggestedTo ? "to" : undefined}
                      style={{
                        background: isSelected
                          ? "var(--accent)"
                          : isSuggestedFrom || isSuggestedTo
                            ? "color-mix(in srgb, var(--info) 46%, var(--board-light))"
                            : isLegal
                              ? "color-mix(in srgb, var(--accent) 34%, var(--board-light))"
                              : dark
                                ? "var(--board-dark)"
                                : "var(--board-light)",
                        color: isDarkPiece ? "var(--piece-dark)" : "var(--piece-light)"
                      }}
                    >
                      {cell.square.col === 0 ? <span className="board-coordinate board-rank">{rows - cell.square.row}</span> : null}
                      {cell.square.row === rows - 1 ? <span className="board-coordinate board-file">{files[cell.square.col]}</span> : null}
                      {cell.piece ? <PieceIcon code={cell.piece.code} owner={cell.piece.owner} variantKey={displayState.variantKey} promoted={cell.piece.promoted} /> : null}
                    </button>
                  );
                })
              )}
            </div>
            {outcome && !isReviewing ? (
              <>
                <div className={`match-result-banner match-result-${outcome.result}`} role="status">
                  <strong>{outcome.headline}</strong>
                  <span>{outcome.detail}</span>
                </div>
                {outcome.celebrate ? <div className="win-celebration" aria-hidden="true" /> : null}
                {showOutcome ? (
                  <div className={`match-result-modal match-result-${outcome.result}`} role="dialog" aria-label="Match over" aria-modal="false">
                    <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Match over</p>
                    <h2>{outcome.headline}</h2>
                    <p>{outcome.detail}</p>
                    <ul className="match-result-context">
                      {outcome.context.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={reset} className="focus-ring action-primary px-4 py-2 text-sm">
                        Play again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOutcome(false);
                          startReview();
                        }}
                        className="focus-ring action-secondary px-4 py-2 text-sm"
                      >
                        Review moves
                      </button>
                      <button type="button" onClick={() => setShowOutcome(false)} className="focus-ring action-secondary px-4 py-2 text-sm">
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="panel board-controls flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2">
            <Swords size={18} className="text-[var(--accent)]" />
            <span className="text-sm font-bold capitalize">{state.turn}</span>
            <span className="text-xs text-[var(--muted)]">{isReviewing ? `review ply ${displayPly}` : state.status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Time control" className="control px-3 py-2 text-sm font-semibold" value={timeControl} onChange={(event) => changeTimeControl(event.target.value as TimeControlKey)}>
              {timeControls.map((control) => (
                <option key={control.key} value={control.key}>
                  {control.label}
                </option>
              ))}
            </select>
            <select aria-label="Bot difficulty" className="control px-3 py-2 text-sm font-semibold" value={botDifficulty} onChange={(event) => setBotDifficulty(event.target.value as BotDifficultyKey)}>
              {botDifficultyLevels.map((level) => (
                <option key={level.key} value={level.key}>
                  {level.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={suggestMove} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" disabled={thinking.status === "thinking" || isReviewing}>
              <Lightbulb size={16} />
              Suggest
            </button>
            {suggestedMove ? (
              <button type="button" onClick={applySuggestion} className="focus-ring action-primary inline-flex items-center gap-2 px-3 py-2 text-sm">
                <Sparkles size={16} />
                Apply suggestion
              </button>
            ) : null}
            <button type="button" onClick={() => void playBotMove("manual")} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" disabled={thinking.status === "thinking" || isReviewing}>
              <PlayCircle size={16} />
              Move for me
            </button>
            <button
              type="button"
              onClick={() => setBotMode((current) => (current === "opponent" ? "human" : "opponent"))}
              className={`focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${
                botMode === "opponent" ? "bg-[var(--accent)] text-black" : "border border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <Bot size={16} />
              Bot opponent
            </button>
            <button
              type="button"
              onClick={() => setBotMode((current) => (current === "both" ? "human" : "both"))}
              className={`focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${
                botMode === "both" ? "bg-[var(--accent)] text-black" : "border border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <Bot size={16} />
              Both bots
            </button>
            {thinking.status === "thinking" ? (
              <button type="button" onClick={cancelThinking} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">
                <PauseCircle size={16} />
                Cancel thinking
              </button>
            ) : null}
            <button type="button" onClick={undo} className="focus-ring action-secondary grid h-10 w-10 place-items-center" aria-label="Undo">
              <Undo2 size={17} />
            </button>
            <button type="button" onClick={reset} className="focus-ring action-secondary grid h-10 w-10 place-items-center" aria-label="Reset">
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
      </div>

      <aside className="game-side-panel play-panel grid content-start gap-4 p-4">
        <div className="play-panel-title">
          <Crown size={34} className="text-[var(--warning)]" />
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">AllChess Arena</p>
            <h2>Play Chess</h2>
          </div>
        </div>
        <p className="play-section-label">Modes</p>
        <div className="play-action-stack">
          {playCards.map((card) => {
            const Icon = card.Icon;
            return (
              <button key={card.key} type="button" onClick={() => void runPlayCardAction(card.key)} className="play-action-card focus-ring" aria-label={card.label}>
                <Icon size={32} />
                <span>
                  <strong>{card.label}</strong>
                  <small>{card.description}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="play-section-label">Setup</p>
        <div className="play-options-card">
          <div className="play-options-heading">
            <Timer size={18} />
            <span>{getTimeControl(timeControl).label}</span>
          </div>
          <div className="play-time-grid" aria-label="Quick time controls">
            {timeControls.slice(0, 6).map((control) => (
              <button key={control.key} type="button" onClick={() => changeTimeControl(control.key)} className={`focus-ring ${timeControl === control.key ? "is-selected" : ""}`}>
                {control.label}
              </button>
            ))}
          </div>
          <div className="play-options-row">
            <SlidersHorizontal size={18} />
            <span>Bot strength</span>
            <strong>{botLevel.label}</strong>
          </div>
          <div className="play-toggle-list" aria-label="Training options">
            <span>Bot Chat</span>
            <span className="toggle-pill is-on" aria-hidden="true" />
            <span>Evaluation Bar</span>
            <span className="toggle-pill" aria-hidden="true" />
            <span>Threat Arrows</span>
            <span className="toggle-pill" aria-hidden="true" />
          </div>
        </div>
        <p className="play-section-label">Status</p>
        <div className="play-table-card">
          <p className="text-sm font-bold text-[var(--muted)]">Table</p>
          <p className="text-2xl font-black capitalize">{state.turn} to move</p>
          {thinking.status === "thinking" ? <p className="mt-1 text-sm font-bold text-[var(--info)]">{thinking.label}</p> : null}
          <p className="mt-1 text-xs font-bold text-[var(--muted)]">
            Bot tier: {botLevel.label} · {botLevel.estimatedStrength} · {botLevel.benchmarkVersion}
          </p>
          {suggestedMove ? (
            <p className="mt-1 text-sm font-bold text-[var(--accent-strong)]">
              Suggestion: {suggestedMove.notation} - depth {suggestedMove.depthReached}
            </p>
          ) : null}
          {notice ? <p className="mt-1 text-sm text-[var(--warning)]">{notice}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {state.clocks.map((clock) => (
            <div key={clock.color} className="play-clock-card">
              <p>{clock.color}</p>
              <strong>{formatClock(clock.remainingMs)}</strong>
            </div>
          ))}
        </div>
        <p className="play-section-label">Review</p>
        <div className="play-review-card">
          <div className="review-tabs" aria-label="Review tabs">
            <button type="button" className="is-active">Moves</button>
            <button type="button">Info</button>
            <button type="button">Openings</button>
          </div>
          <div className="review-engine-row">
            <span className="inline-flex items-center gap-2">
              <Brain size={16} className="text-[var(--accent)]" />
              Analysis
            </span>
            <span>Stockfish 18 Lite</span>
          </div>
          <div className="review-position-card">
            <p>{displayPly === 0 ? "Starting position" : `Position after ${activeReviewMove?.notation ?? "latest move"}`}</p>
            <strong>{activeReviewMove ? `${activeReviewMove.label} - ${activeReviewMove.score}/100` : "Ready for review"}</strong>
            <span>{activeReviewMove?.detail ?? "Make a move, then use Game Review to replay the position with move quality labels."}</span>
            {activeReviewMove ? <small>Best line: {activeReviewMove.bestLine}</small> : null}
          </div>
          <ol className="review-move-list move-list max-h-64 overflow-auto text-sm">
            <li className={displayPly === 0 ? "is-active" : ""}>
              <button type="button" onClick={() => setReviewCursor(0)} className="focus-ring">
                <span>0.</span>
                <strong>Starting position</strong>
                <em>Info</em>
              </button>
            </li>
            {reviewMoves.length ? (
              reviewMoves.map((move) => (
                <li key={`${move.notation}-${move.ply}`} className={displayPly === move.ply ? "is-active" : ""} data-review={move.classification}>
                  <button type="button" onClick={() => setReviewCursor(move.ply)} className="focus-ring" aria-label={`Review move ${move.ply} ${move.notation}`}>
                    <span>{move.ply}.</span>
                    <strong>{move.notation}</strong>
                    <em>{move.label}</em>
                  </button>
                </li>
              ))
            ) : (
              <li>
                <button type="button" className="focus-ring" disabled>
                  <span>1.</span>
                  <strong>No moves yet</strong>
                  <em>Info</em>
                </button>
              </li>
            )}
          </ol>
          <div className="review-summary-row">
            <span data-review="best">{reviewSummary.best} Best</span>
            <span data-review="excellent">{reviewSummary.excellent} Excellent</span>
            <span data-review="blunder">{reviewSummary.blunder} Blunder</span>
          </div>
          <button type="button" onClick={startReview} className="focus-ring review-primary-button">
            <Sparkles size={20} />
            Game Review
          </button>
          <div className="review-controls" aria-label="Review playback controls">
            <button type="button" onClick={() => setReviewCursor(0)} className="focus-ring" aria-label="First move" disabled={!reviewMoves.length}>
              <SkipBack size={20} />
            </button>
            <button type="button" onClick={() => setReviewCursor(displayPly - 1)} className="focus-ring" aria-label="Previous move" disabled={!reviewMoves.length || displayPly === 0}>
              <Undo2 size={20} />
            </button>
            <button type="button" onClick={() => setReviewPlaying((current) => !current)} className="focus-ring is-main" aria-label={reviewPlaying ? "Pause review" : "Play review"} disabled={!reviewMoves.length}>
              {reviewPlaying ? <PauseCircle size={24} /> : <PlayCircle size={24} />}
            </button>
            <button type="button" onClick={() => setReviewCursor(displayPly + 1)} className="focus-ring" aria-label="Next move" disabled={!reviewMoves.length || displayPly >= timeline.length - 1}>
              <PlayCircle size={20} />
            </button>
            <button type="button" onClick={() => setReviewCursor(timeline.length - 1)} className="focus-ring" aria-label="Last move" disabled={!reviewMoves.length}>
              <SkipForward size={20} />
            </button>
          </div>
          {isReviewing ? (
            <button type="button" onClick={jumpToLive} className="focus-ring review-live-button">
              Back to live board
            </button>
          ) : null}
        </div>
        <div className="play-table-card text-sm text-[var(--muted)]">
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

function navigateToSibling(section: "lobby" | "variants") {
  const [, locale = "en"] = window.location.pathname.split("/");
  window.location.href = `/${locale}/${section}`;
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

function formatMove(from: Square, to: Square, files: string[], rows: number) {
  return `${squareName(from, files, rows)} to ${squareName(to, files, rows)}`;
}

function squareName(square: Square, files: string[], rows: number) {
  return `${files[square.col] ?? square.col}${rows - square.row}`;
}

function pieceName(code: string) {
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
