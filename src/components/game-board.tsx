"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  Brain,
  Crown,
  Eye,
  Flag,
  FlipHorizontal2,
  Handshake,
  Lightbulb,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Share2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Timer,
  Undo2,
  X,
} from "lucide-react";

import { botDifficultyLevels, MAX_BOT_REPLY_MS, type BotDifficultyKey } from "@/lib/bot-config";
import { getVariantBotStrengthProfile } from "@/lib/bot-strength";
import type { BotMoveResult } from "@/lib/bots";
import { formatClock, settleTurnClockElapsed, tickGameClock } from "@/lib/clocks";
import { analyzeMoveList, summarizeReview } from "@/lib/game-review";
import { describeGameOutcome } from "@/lib/game-outcome";
import type { VariantRuleSummary } from "@/lib/rules-atlas";
import { getTimeControl, timeControls, type TimeControlKey } from "@/lib/time-controls";
import { applyMove, createInitialState, getLegalMoves, sameSquare, serializeSquare, type GameState, type Square } from "@/lib/variants";
import { PieceIcon } from "@/components/piece-icon";

type BotMode = "human" | "opponent" | "both";
type PlayMode = "online" | "bot" | "offline" | "room" | "matchmaking" | "spectate";
type SeatChoice = "random" | "first" | "second";
type BoardOrientation = "auto" | "first" | "second";
type PanelTab = "setup" | "status" | "review";

const playModeOptions: Array<{ key: PlayMode; label: string; description: string; Icon: typeof Swords }> = [
  { key: "online", label: "Play Online", description: "Match with a player", Icon: Swords },
  { key: "bot", label: "Play Bots", description: "Practice by tier", Icon: Bot },
  { key: "offline", label: "Offline Local", description: "Same device", Icon: Crown },
  { key: "room", label: "Create Room", description: "Invite by code", Icon: Flag },
  { key: "matchmaking", label: "Matchmaking", description: "Queue by settings", Icon: Timer },
  { key: "spectate", label: "Spectate", description: "Watch rooms", Icon: Eye }
];

const panelTabOptions: Array<{ key: PanelTab; label: string; Icon: typeof Swords }> = [
  { key: "setup", label: "Setup", Icon: SlidersHorizontal },
  { key: "status", label: "Status", Icon: Activity },
  { key: "review", label: "Review", Icon: Brain }
];

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

async function requestRuntimeBotMove(...args: Parameters<typeof import("@/lib/bots").requestBotMove>) {
  const { requestBotMove } = await import("@/lib/bots");
  return requestBotMove(...args);
}

function cancelRuntimeBotMove(requestId: string) {
  void import("@/lib/bots").then(({ cancelBotMove }) => cancelBotMove(requestId));
}

export function GameBoard({
  variantKey,
  initialState,
  rulesSummary,
  initialBotMode = "human",
  initialPlayMode,
  title = "Game",
  meta = "AllChess",
  objective = "Play a legal game."
}: {
  variantKey: string;
  initialState?: GameState;
  rulesSummary?: VariantRuleSummary;
  initialBotMode?: BotMode;
  initialPlayMode?: PlayMode;
  title?: string;
  meta?: string;
  objective?: string;
}) {
  const [timeControl, setTimeControl] = useState<TimeControlKey>("rapid");
  const [state, setState] = useState(() => withTimeControl(initialState ?? createInitialState(variantKey), "rapid"));
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>(initialPlayMode ?? (initialBotMode === "opponent" ? "bot" : "offline"));
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyKey>("normal");
  const [botMode, setBotMode] = useState<BotMode>(initialBotMode);
  const [seatChoice, setSeatChoice] = useState<SeatChoice>("random");
  const [boardOrientation, setBoardOrientation] = useState<BoardOrientation>("auto");
  const [humanColor, setHumanColor] = useState(() => pickHumanColor(withTimeControl(initialState ?? createInitialState(variantKey), "rapid"), "first"));
  const [thinking, setThinking] = useState<ThinkingState>({ status: "idle", label: "" });
  const [suggestedMove, setSuggestedMove] = useState<SuggestedMove | null>(null);
  const [lastBotResult, setLastBotResult] = useState<BotMoveResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("setup");
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const activeBotRequestRef = useRef<string | null>(null);
  const resolvedRandomSeatRef = useRef(false);

  const timeline = useMemo(() => (history.length ? [...history, state] : [state]), [history, state]);
  const reviewMoves = useMemo(() => analyzeMoveList(state.moves), [state.moves]);
  const reviewSummary = useMemo(() => summarizeReview(reviewMoves), [reviewMoves]);
  const displayPly = reviewPly ?? timeline.length - 1;
  const displayState = timeline[Math.min(displayPly, timeline.length - 1)] ?? state;
  const activeReviewMove = displayPly > 0 ? reviewMoves[displayPly - 1] : null;
  const isReviewing = reviewPly !== null;
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : []), [selected, state]);
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => serializeSquare(move.to))), [legalMoves]);
  const botColor = state.clocks.find((clock) => clock.color !== humanColor)?.color ?? state.clocks[1]?.color ?? "black";
  const rows = displayState.board.length;
  const cols = displayState.board[0]?.length ?? 8;
  const files = useMemo(() => Array.from({ length: cols }, (_, index) => String.fromCharCode(97 + index)), [cols]);
  const botLevel = botDifficultyLevels.find((level) => level.key === botDifficulty) ?? botDifficultyLevels[1];
  const botStrength = useMemo(() => getVariantBotStrengthProfile(variantKey, botDifficulty), [botDifficulty, variantKey]);
  const botCalibrationLabel = botStrength.calibrationStatus.replace(/-/g, " ");
  const botResponseBudget = Math.min(botLevel.moveTimeMs, MAX_BOT_REPLY_MS - 180);
  const outcome = useMemo(() => describeGameOutcome(state, humanColor), [humanColor, state]);
  const firstColor = state.clocks[0]?.color ?? "white";
  const secondColor = state.clocks[1]?.color ?? "black";
  const isThinking = thinking.status === "thinking";
  const isOnlineMode = playMode === "online" || playMode === "matchmaking" || playMode === "room";
  const isBotPractice = playMode === "bot";
  const isSpectating = playMode === "spectate";
  const isSearchingOnline = gameStarted && isOnlineMode && state.status === "active";
  const canUseAssist = gameStarted && state.status === "active" && !isThinking && !isReviewing && !isOnlineMode && !isSpectating;
  const canUseBots = gameStarted && state.status === "active" && !isThinking && !isReviewing && !isOnlineMode && !isSpectating;
  const canUndo = history.length > 0 && !isThinking && !isReviewing && !isOnlineMode && !isSpectating;
  const canEndGame = gameStarted && state.status === "active" && !isReviewing && !isSpectating && !isSearchingOnline;
  const visualOrientation = boardOrientation === "auto" ? (humanColor === secondColor ? "second" : "first") : boardOrientation;
  const isBoardFlipped = visualOrientation === "second";
  const orientedRows = useMemo(() => {
    const rowsToRender = displayState.board.map((row) => [...row]);
    return isBoardFlipped ? rowsToRender.reverse().map((row) => row.reverse()) : rowsToRender;
  }, [displayState.board, isBoardFlipped]);
  const modeDetails = playModeOptions.find((option) => option.key === playMode) ?? playModeOptions[2];
  const phaseLabel = isSearchingOnline
    ? "Searching for opponent..."
    : thinking.status === "thinking"
      ? thinking.label
      : gameStarted
        ? `${colorLabel(state.turn)} to move`
        : "Choose setup";
  const modeSummary = gameStarted ? `${modeDetails.label} - ${getTimeControl(timeControl).label}` : `${modeDetails.label} setup`;
  const topPlayerColor = isBoardFlipped ? firstColor : secondColor;
  const bottomPlayerColor = isBoardFlipped ? secondColor : firstColor;
  const capturedBy = useCallback(
    (color: string) => state.captured.filter((piece) => piece.owner !== color),
    [state.captured]
  );

  function playerCard(color: string, placement: "top" | "bottom") {
    const isHuman = color === humanColor;
    const isBot = color === botColor && botMode !== "human";
    const capturedPieces = capturedBy(color);
    const clock = state.clocks.find((entry) => entry.color === color);
    return (
      <div className={`board-player-card board-player-card-${placement} ${state.turn === color ? "is-active" : ""}`}>
        <div className="player-avatar" aria-hidden="true">{isBot ? "AI" : isHuman ? "You" : colorLabel(color).slice(0, 2)}</div>
        <div className="player-card-main">
          <div className="player-card-row">
            <strong>{isHuman ? "Your profile" : isBot ? `${botLevel.label} bot` : `${colorLabel(color)} player`}</strong>
            <span>{clock ? formatClock(clock.remainingMs) : "--:--"}</span>
          </div>
          <p>{isBot ? `${botStrength.display} - ${botCalibrationLabel} - ${thinking.status === "thinking" ? "thinking" : "ready"}` : isHuman ? `${colorLabel(color)} side - local profile` : `${colorLabel(color)} side`}</p>
        </div>
        <div className="captured-strip" aria-label={`${colorLabel(color)} captured pieces`}>
          {capturedPieces.length ? (
            capturedPieces.slice(0, 12).map((piece, index) => (
              <span key={`${piece.id}-${index}`} className="captured-piece">
                <PieceIcon code={piece.code} owner={piece.owner} variantKey={displayState.variantKey} promoted={piece.promoted} />
              </span>
            ))
          ) : (
            <span className="captured-empty">No captures</span>
          )}
        </div>
      </div>
    );
  }

  function choose(square: Square) {
    if (!gameStarted) {
      setNotice("Choose a mode and press Start Game first.");
      setPanelTab("setup");
      return;
    }
    if (isReviewing) {
      setNotice("Review mode is showing a saved position. Jump to live to keep playing.");
      return;
    }
    if (isOnlineMode) {
      setNotice("Searching for opponent. Board moves unlock after a live opponent is paired.");
      setPanelTab("status");
      return;
    }
    if (state.status === "completed" || thinking.status === "thinking") return;
    if (botMode === "both" || (botMode === "opponent" && state.turn !== humanColor)) {
      setNotice(botMode === "both" ? "Both bots are controlling the board." : "Bot is to move. You can change sides or cancel bot mode.");
      return;
    }
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
        setLastBotResult(result);
        setNotice("Bot thinking was cancelled.");
        return;
      }

      if (!result.move) {
        setLastBotResult(result);
        setNotice(result.status === "no-legal-moves" ? "No legal moves are available. Review the final position or reset the board." : result.error ?? "Bot move failed.");
        return;
      }

      const move = result.move;
      setLastBotResult(result);
      setHistory((current) => [...current, snapshot]);
      setState((current) => {
        if (current.id !== snapshot.id || current.ply !== snapshot.ply || current.turn !== snapshot.turn) return current;
        const clockSettled = settleTurnClockElapsed(current, snapshot, result.elapsedMs);
        if (clockSettled.status !== "active") return clockSettled;
        return applyMove(clockSettled, move);
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

      const result = await requestRuntimeBotMove(snapshot, botDifficulty, {
        requestId,
        delayMs: source === "auto" ? 80 : 0,
        maxSearchTimeMs: Math.min(botLevel.moveTimeMs, MAX_BOT_REPLY_MS - 180)
      });
      finishBotRequest(snapshot, result, source);
    },
    [botDifficulty, botLevel.moveTimeMs, finishBotRequest, state]
  );

  async function suggestMove() {
    if (state.status !== "active" || activeBotRequestRef.current || isReviewing) return;
    const quickMove = quickSuggestionMove(state);
    if (quickMove) {
      setLastBotResult(null);
      setSuggestedMove({
        from: quickMove.from,
        to: quickMove.to,
        notation: formatMove(quickMove.from, quickMove.to, files, rows),
        score: null,
        depthReached: 0
      });
      setSelected(quickMove.from);
      setNotice(null);
      return;
    }

    const requestId = crypto.randomUUID();
    activeBotRequestRef.current = requestId;
    setThinking({ status: "thinking", label: "Finding a suggestion..." });
    setNotice(null);

    const result = await requestRuntimeBotMove(state, botDifficulty, { requestId, maxSearchTimeMs: Math.min(botLevel.moveTimeMs, 1800, MAX_BOT_REPLY_MS - 180) });
    if (activeBotRequestRef.current !== requestId) return;
    activeBotRequestRef.current = null;
    setThinking({ status: "idle", label: "" });

    if (!result.move) {
      setLastBotResult(result);
      setSuggestedMove(null);
      setNotice("No legal moves are available.");
      return;
    }

    setLastBotResult(result);
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
    setLastBotResult(null);
    setNotice("Suggestion applied.");
    setPanelTab("review");
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function cancelThinking() {
    const requestId = activeBotRequestRef.current;
    if (!requestId) return;
    cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    setThinking({ status: "cancelled", label: "Cancelled" });
    setNotice("Bot thinking was cancelled.");
  }

  function offerDraw() {
    if (!canEndGame) return;
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    setState((current) => ({
      ...current,
      status: "completed",
      result: "draw",
      outcomeReason: "draw"
    }));
    setThinking({ status: "idle", label: "" });
    setSelected(null);
    setSuggestedMove(null);
    setShowOutcome(true);
    setNotice("Game ended by agreed draw.");
  }

  function resignGame() {
    if (!canEndGame) return;
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    const winner = state.clocks.find((clock) => clock.color !== state.turn)?.color;
    setState((current) => ({
      ...current,
      status: "completed",
      result: winner ?? "draw",
      outcomeReason: "resignation"
    }));
    setThinking({ status: "idle", label: "" });
    setSelected(null);
    setSuggestedMove(null);
    setShowOutcome(true);
    setNotice("Resignation recorded.");
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setState(previous);
    setSelected(null);
    setSuggestedMove(null);
    setLastBotResult(null);
    setNotice(null);
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function reset() {
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    const nextState = withTimeControl(createInitialState(variantKey), timeControl);
    resolvedRandomSeatRef.current = false;
    setHistory([]);
    setState(nextState);
    setHumanColor(pickHumanColor(nextState, seatChoice));
    setGameStarted(false);
    setSelected(null);
    setSuggestedMove(null);
    setLastBotResult(null);
    setNotice(null);
    setThinking({ status: "idle", label: "" });
    setShowOutcome(false);
    setPanelTab("setup");
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function changeTimeControl(nextControl: TimeControlKey) {
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    const nextState = withTimeControl(createInitialState(variantKey), nextControl);
    resolvedRandomSeatRef.current = false;
    setTimeControl(nextControl);
    setHistory([]);
    setState(nextState);
    setHumanColor(pickHumanColor(nextState, seatChoice));
    setGameStarted(false);
    setSelected(null);
    setSuggestedMove(null);
    setLastBotResult(null);
    setNotice(null);
    setThinking({ status: "idle", label: "" });
    setShowOutcome(false);
    setPanelTab("setup");
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function changeSeatChoice(nextChoice: SeatChoice) {
    setSeatChoice(nextChoice);
    const nextColor = nextChoice === "random" && !gameStarted ? firstColor : pickHumanColor(state, nextChoice);
    setHumanColor(nextColor);
    setNotice(nextChoice === "random" && !gameStarted ? "Random side will be chosen when the game starts." : `You are playing ${colorLabel(nextColor)}.`);
  }

  function startGame() {
    const nextColor = pickHumanColor(state, seatChoice);
    resolvedRandomSeatRef.current = true;
    setHumanColor(nextColor);
    setBotMode(isBotPractice ? "opponent" : "human");
    setBoardOrientation("auto");
    setLastBotResult(null);
    setGameStarted(true);
    setPanelTab("status");
    setNotice(isOnlineMode ? `Searching for opponent in ${modeDetails.label}. You will play ${colorLabel(nextColor)} when paired.` : `${modeDetails.label} started. You are playing ${colorLabel(nextColor)}.`);
  }

  function selectPlayMode(nextMode: PlayMode) {
    setPlayMode(nextMode);
    if (nextMode !== "bot") {
      setBotMode("human");
      setLastBotResult(null);
    }
    if (nextMode === "online" || nextMode === "matchmaking" || nextMode === "room") {
      setNotice("Online play selected. Bot controls are disabled while matchmaking or room pairing is active.");
    } else if (nextMode === "spectate") {
      setNotice("Spectate mode selected. Bot controls are disabled while you watch rooms.");
    } else {
      setNotice(null);
    }
  }

  function flipBoard() {
    setBoardOrientation((current) => {
      const next = current === "second" ? "first" : "second";
      setNotice(`Board view flipped to ${next === "second" ? colorLabel(secondColor) : colorLabel(firstColor)} side.`);
      return next;
    });
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
    if (!gameStarted || resolvedRandomSeatRef.current || seatChoice !== "random") return;
    resolvedRandomSeatRef.current = true;
    setHumanColor(pickHumanColor(state, "random"));
  }, [gameStarted, seatChoice, state]);

  useEffect(() => {
    if (!gameStarted || isReviewing || state.status !== "active" || thinking.status === "thinking") return;
    const shouldMove = botMode === "both" || (botMode === "opponent" && state.turn === botColor);
    if (!shouldMove) return;
    const snapshot = state;
    const timer = window.setTimeout(() => {
      void playBotMove("auto", snapshot);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [botColor, botMode, gameStarted, isReviewing, playBotMove, state, thinking.status]);

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
      if (!gameStarted) return;
      setState((current) => tickGameClock(current, elapsed));
    }, 250);
    return () => window.clearInterval(timer);
  }, [gameStarted]);

  return (
    <div className="game-board-layout grid gap-4">
      <div className="grid gap-3">
        {playerCard(topPlayerColor, "top")}
        <div className="board-shell" data-variant-size={`${cols}x${rows}`} style={{ "--board-cols": cols, "--board-rows": rows } as CSSProperties}>
          <div className="board-stage">
            <div className="board-grid overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-label="Game board">
              {orientedRows.flatMap((row, visualRow) =>
                row.map((cell, visualCol) => {
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
                      data-tone={dark ? "dark" : "light"}
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
                      {visualCol === 0 ? <span className="board-coordinate board-rank">{rows - cell.square.row}</span> : null}
                      {visualRow === rows - 1 ? <span className="board-coordinate board-file">{files[cell.square.col]}</span> : null}
                      {cell.piece ? <PieceIcon code={cell.piece.code} owner={cell.piece.owner} variantKey={displayState.variantKey} promoted={cell.piece.promoted} /> : null}
                    </button>
                  );
                })
              )}
            </div>
            {!gameStarted ? (
              <div className="pregame-board-overlay" role="status">
                <strong>Choose setup first</strong>
                <span>{modeDetails.label} · {getTimeControl(timeControl).label} · {seatChoice === "random" ? "Random side" : colorLabel(humanColor)}</span>
              </div>
            ) : null}
            {outcome && !isReviewing ? (
              <>
                <div className={`match-result-banner match-result-${outcome.result}`} role="status">
                  <strong>{outcome.headline}</strong>
                  <span>{outcome.detail}</span>
                </div>
                {outcome.celebrate ? <div className="win-celebration" aria-hidden="true" /> : null}
                {showOutcome ? (
                  <div className={`match-result-modal match-result-${outcome.result}`} role="dialog" aria-label="Match over" aria-modal="false">
                    <button type="button" className="match-result-close focus-ring" aria-label="Close match result" title="Close this result panel and view the board." onClick={() => setShowOutcome(false)}>
                      <X size={16} />
                    </button>
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
        {playerCard(bottomPlayerColor, "bottom")}
      </div>

      <aside className="game-side-panel play-panel grid content-start gap-4 p-4">
        <div className="play-panel-match-header">
          <div className="play-title-block">
            <div className="play-title-row">
              <h1>{title}</h1>
              {rulesSummary ? (
                <button type="button" title="Open rules, win conditions, and draw notes." onClick={() => setShowRules(true)} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" aria-label="Rules summary">
                  <BookOpen size={16} />
                  Rules
                </button>
              ) : null}
            </div>
            <div className="play-title-meta" aria-label="Match summary">
              <span className="inline-flex items-center gap-2">
                <Swords size={14} />
                {meta}
              </span>
              <strong title={objective}>{modeSummary}</strong>
              <em>{phaseLabel}</em>
            </div>
          </div>
          <div className="play-command-actions play-header-command-actions">
            <button type="button" title="Reset the game with the current setup." onClick={reset} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">
              <RotateCcw size={16} />
              <span className="button-label">New</span>
            </button>
            <button type="button" onClick={() => { selectPlayMode("room"); setPanelTab("setup"); setNotice("Room setup selected. Bot controls are disabled while waiting for a player."); }} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title="Switch to room setup for a shareable game.">
              <Share2 size={16} />
              <span className="button-label">Room</span>
            </button>
            <button type="button" onClick={() => { selectPlayMode("spectate"); setPanelTab("setup"); }} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title="Switch to spectator mode for live rooms.">
              <Eye size={16} />
              <span className="button-label">Watch</span>
            </button>
            <button type="button" onClick={offerDraw} disabled={!canEndGame} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title={canEndGame ? "End this local game as a draw." : "Draw is unavailable until an active playable game starts."}>
              <Handshake size={16} />
              <span className="button-label">Draw</span>
            </button>
            <button type="button" onClick={resignGame} disabled={!canEndGame} className="focus-ring inline-flex items-center gap-2 rounded-md border border-[var(--danger)] px-3 py-2 text-sm font-bold text-[var(--danger)]" title={canEndGame ? "Resign the active game." : "Resign is unavailable until an active game starts."}>
              <Flag size={16} />
              <span className="button-label">Resign</span>
            </button>
          </div>
        </div>
        <div className="play-section-tabs" aria-label="Game tool sections">
          {panelTabOptions.map(({ key, label, Icon }) => (
            <button key={key} type="button" title={`Show ${label} tools`} onClick={() => setPanelTab(key)} className={`focus-ring ${panelTab === key ? "is-active" : ""}`}>
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="play-tab-panel">
          {panelTab === "setup" ? (
            gameStarted ? (
              <div className="play-options-card play-active-setup-card">
                <div className="play-options-heading">
                  <Activity size={18} />
                  <span>Game in progress</span>
                </div>
                <div className="active-setup-summary">
                  <span>{modeDetails.label}</span>
                  <strong>{getTimeControl(timeControl).label}</strong>
                  <small>You are {colorLabel(humanColor)}. Open Status for side, clock, bot tier, and move details.</small>
                </div>
                <div className="play-action-row">
                  <button type="button" onClick={() => setPanelTab("status")} className="focus-ring action-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm">
                    <Activity size={16} />
                    Status
                  </button>
                  <button type="button" onClick={reset} className="focus-ring action-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm">
                    <RotateCcw size={16} />
                    New setup
                  </button>
                </div>
              </div>
            ) : (
              <div className="play-options-card">
                <div className="play-mode-grid" aria-label="Play modes">
                  {playModeOptions.map(({ key, label, description, Icon }) => (
                    <button key={key} type="button" onClick={() => selectPlayMode(key)} className={`focus-ring play-mode-button ${playMode === key ? "is-selected" : ""}`}>
                      <Icon size={17} />
                      <span>{label}</span>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
                <div className="play-options-heading">
                  <Timer size={18} />
                  <span>{getTimeControl(timeControl).label}</span>
                </div>
                <label className="play-setup-field">
                  <span>Side</span>
                  <select aria-label="Side" value={seatChoice} onChange={(event) => changeSeatChoice(event.target.value as SeatChoice)}>
                    <option value="random">Random side</option>
                    <option value="first">{colorLabel(firstColor)}</option>
                    <option value="second">{colorLabel(secondColor)}</option>
                  </select>
                </label>
                <label className={`play-setup-field ${!isBotPractice ? "is-disabled" : ""}`} title={isBotPractice ? "Choose how strong the bot should be." : "Bot difficulty is only used in Play Bots mode."}>
                  <span>Bot difficulty</span>
                  <select aria-label="Bot difficulty" value={botDifficulty} onChange={(event) => setBotDifficulty(event.target.value as BotDifficultyKey)} disabled={!isBotPractice}>
                    {botDifficultyLevels.map((level) => (
                      <option key={level.key} value={level.key}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="play-time-grid" aria-label="Quick time controls">
                  {timeControls.slice(0, 6).map((control) => (
                    <button key={control.key} type="button" title={`Start a new ${control.label} game`} onClick={() => changeTimeControl(control.key)} className={`focus-ring ${timeControl === control.key ? "is-selected" : ""}`}>
                      {control.label}
                    </button>
                  ))}
                </div>
                <div className="play-options-row">
                  <SlidersHorizontal size={18} />
                  <span>Side</span>
                  <strong>{colorLabel(humanColor)}</strong>
                </div>
                <button type="button" onClick={startGame} className="focus-ring action-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
                  <PlayCircle size={18} />
                  Start Game
                </button>
                <p className="text-xs font-bold text-[var(--muted)]">Choose mode, side, clock, and bot tier first. During play, Status keeps the live controls compact.</p>
              </div>
            )
          ) : null}
          {panelTab === "status" ? (
            <div className="grid gap-3">
              <div className="play-control-card" aria-label="Board controls">
                <div className="play-control-heading">
                  <SlidersHorizontal size={17} />
                  <strong>Board controls</strong>
                  <span>{gameStarted ? "Live" : "Start first"}</span>
                </div>
                <div className="play-control-groups">
                  <section className="play-control-section" aria-label="Assist controls">
                    <div className="play-control-group-label">
                      <span>Assist</span>
                      <small>{canUseAssist ? "Ready" : "Locked"}</small>
                    </div>
                    <div className="play-control-group play-control-group-primary" aria-label="Move help">
                      <button
                        type="button"
                        title={
                          canUseAssist
                            ? "Find and highlight a legal candidate move for the current side."
                            : "Suggestions are disabled for online, room, spectate, review, completed, or not-started states."
                        }
                        onClick={suggestMove}
                        className="focus-ring action-secondary play-control-button"
                        disabled={!canUseAssist}
                      >
                        <Lightbulb size={16} />
                        <span>Suggest</span>
                      </button>
                      <button
                        type="button"
                        title={suggestedMove ? "Apply the highlighted suggestion to the board." : "Generate a suggestion first."}
                        aria-label={suggestedMove ? "Apply suggestion" : "Apply disabled"}
                        onClick={applySuggestion}
                        className="focus-ring action-primary play-control-button is-main"
                        disabled={!canUseAssist || !suggestedMove}
                      >
                        <Sparkles size={16} />
                        <span>Apply</span>
                      </button>
                      <button
                        type="button"
                        title={
                          canUseAssist
                            ? "Ask the bot engine to move for whichever side is currently to move."
                            : "Move for me is disabled for online, room, spectate, review, completed, or not-started states."
                        }
                        onClick={() => void playBotMove("manual")}
                        className="focus-ring action-secondary play-control-button"
                        disabled={!canUseAssist}
                      >
                        <PlayCircle size={16} />
                        <span>Move</span>
                      </button>
                    </div>
                  </section>
                  <section className="play-control-section" aria-label="Bot automation controls">
                    <div className="play-control-group-label">
                      <span>Bot automation</span>
                      <small>{isOnlineMode ? "Human match only" : canUseBots ? "Ready" : "Locked"}</small>
                    </div>
                    <div className="play-control-group play-control-group-bots" aria-label="Bot automation">
                      <button
                        type="button"
                        aria-label="Play Bots"
                        title={
                          canUseBots
                            ? "Toggle bot opponent. You move your selected side; the bot replies for the other side."
                            : "Bot opponent is disabled for online, room, spectate, review, completed, or not-started states."
                        }
                        onClick={() => {
                          setBotMode((current) => {
                            const next = current === "opponent" ? "human" : "opponent";
                            setNotice(
                              next === "opponent" ? "Bot opponent is on. Make a move and the bot will reply automatically." : "Bot opponent is off."
                            );
                            setPanelTab("status");
                            return next;
                          });
                        }}
                        disabled={!canUseBots}
                        className={`focus-ring play-control-button ${
                          botMode === "opponent" ? "bg-[var(--accent)] text-black" : "border border-[var(--border)] bg-[var(--surface)]"
                        }`}
                      >
                        <Bot size={16} />
                        <span>Bot</span>
                      </button>
                      <button
                        type="button"
                        title={canUseBots ? "Let bots control both sides until you turn this off." : "Auto is disabled for online, room, spectate, review, completed, or not-started states."}
                        onClick={() => setBotMode((current) => (current === "both" ? "human" : "both"))}
                        disabled={!canUseBots}
                        className={`focus-ring play-control-button ${
                          botMode === "both" ? "bg-[var(--accent)] text-black" : "border border-[var(--border)] bg-[var(--surface)]"
                        }`}
                      >
                        <Bot size={16} />
                        <span>Auto</span>
                      </button>
                    </div>
                  </section>
                  <section className="play-control-section" aria-label="Board utility controls">
                    <div className="play-control-group-label">
                      <span>Utilities</span>
                      <small>Board</small>
                    </div>
                    <div className="play-control-group play-control-group-utility" aria-label="Board utilities">
                      <button
                        type="button"
                        title="Flip the visual board orientation without changing sides."
                        onClick={flipBoard}
                        className="focus-ring action-secondary play-icon-button"
                        aria-label="Flip board"
                      >
                        <FlipHorizontal2 size={16} />
                      </button>
                      <button
                        type="button"
                        title={isThinking ? "Stop the current bot search." : "Cancel is available only while the bot is thinking."}
                        onClick={cancelThinking}
                        className="focus-ring action-secondary play-icon-button"
                        disabled={!isThinking}
                        aria-label="Cancel thinking"
                      >
                        <PauseCircle size={16} />
                      </button>
                      <button
                        type="button"
                        title={canUndo ? "Undo the last local move." : "Undo is disabled for online, room, spectate, review, thinking, or empty history states."}
                        onClick={undo}
                        className="focus-ring action-secondary play-icon-button"
                        aria-label="Undo"
                        disabled={!canUndo}
                      >
                        <Undo2 size={16} />
                      </button>
                      <button
                        type="button"
                        title="Reset the game with the current setup."
                        onClick={reset}
                        className="focus-ring action-secondary play-icon-button"
                        aria-label="Reset"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </section>
                </div>
              </div>
              <div className="play-table-card">
                <p className="text-sm font-bold text-[var(--muted)]">Current position</p>
                <p className="text-2xl font-black capitalize">{colorLabel(state.turn)} to move</p>
                {thinking.status === "thinking" ? <p className="mt-1 text-sm font-bold text-[var(--info)]">{thinking.label}</p> : null}
                {isOnlineMode ? (
                  <div className="online-search-card" role="status" aria-label="Online matchmaking status">
                    <Swords size={18} />
                    <div>
                      <strong>{isSearchingOnline ? "Searching for opponent" : "Online opponent required"}</strong>
                      <span>{isSearchingOnline ? "Bot difficulty and automation are paused while AllChess looks for a human player." : "Choose Online, Room, or Matchmaking settings, then start searching."}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bot-profile-card">
                      <Bot size={18} />
                      <div>
                        <strong>{botLevel.label} bot</strong>
                        <span title={botStrength.basis}>{botStrength.display} - {botCalibrationLabel}</span>
                      </div>
                      <small title={botStrength.basis}>target {botStrength.targetElo}</small>
                    </div>
                    <p className="bot-tier-note" title={botStrength.basis}>{botLevel.estimatedStrength}</p>
                    <div className="bot-readiness-row" aria-label="Bot response profile">
                      <span title="Maximum reply time for this tier in the browser.">under {botResponseBudget}ms</span>
                      <span title="Opening and tactical knowledge are checked before live search.">cache first</span>
                      <span title={botStrength.basis}>{botCalibrationLabel}</span>
                    </div>
                    <label className="play-setup-field mt-3">
                      <span>Bot difficulty</span>
                      <select aria-label="Bot difficulty" value={botDifficulty} onChange={(event) => setBotDifficulty(event.target.value as BotDifficultyKey)}>
                        {botDifficultyLevels.map((level) => (
                          <option key={level.key} value={level.key}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                  You: {colorLabel(humanColor)} · View: {visualOrientation === "second" ? colorLabel(secondColor) : colorLabel(firstColor)}
                </p>
                <div className="bot-stat-grid" aria-label="Bot search profile">
                  <span>
                    <small>Depth</small>
                    <strong>{botLevel.depth}</strong>
                  </span>
                  <span>
                    <small>Budget</small>
                    <strong>{botLevel.moveTimeMs}ms</strong>
                  </span>
                  <span>
                    <small>Nodes</small>
                    <strong>{botLevel.nodeBudget}</strong>
                  </span>
                </div>
                {lastBotResult ? (
                  <div className="bot-explanation-card">
                    <p>
                      <strong>Bot source:</strong> {lastBotResult.knowledgeSource ?? lastBotResult.engine} - depth {lastBotResult.depthReached} - nodes {lastBotResult.nodesSearched}
                    </p>
                    {lastBotResult.searchEfficiency ? (
                      <span>
                        Reused {lastBotResult.searchEfficiency.cacheHits} move buckets and {lastBotResult.searchEfficiency.transpositionHits} transpositions from{" "}
                        {lastBotResult.searchEfficiency.transpositionEntries} stored positions.
                      </span>
                    ) : null}
                    {lastBotResult.explanation ? (
                      <>
                        <span>{lastBotResult.explanation.plan}</span>
                        <span>{lastBotResult.explanation.threat}</span>
                        <span>{lastBotResult.explanation.risk}</span>
                        <span>{lastBotResult.explanation.fallbackGoal}</span>
                      </>
                    ) : (
                      <span>Move was validated by the rules engine before it could affect the board.</span>
                    )}
                  </div>
                ) : null}
                {suggestedMove ? (
                  <p className="mt-1 text-sm font-bold text-[var(--accent-strong)]">
                    Suggestion: {suggestedMove.notation} - depth {suggestedMove.depthReached}
                  </p>
                ) : null}
                {notice ? <p className="mt-1 text-sm text-[var(--warning)]">{notice}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {state.clocks.map((clock) => (
                  <div key={clock.color} className={`play-clock-card ${state.turn === clock.color ? "is-active" : ""}`}>
                    <p>{colorLabel(clock.color)}</p>
                    <strong>{formatClock(clock.remainingMs)}</strong>
                    <span>{state.turn === clock.color ? "to move" : clock.color === humanColor ? "you" : botMode !== "human" && clock.color === botColor ? "bot" : "waiting"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {panelTab === "review" ? (
            <div className="play-review-card">
              <div className="review-engine-row">
                <span className="inline-flex items-center gap-2">
                  <Brain size={16} className="text-[var(--accent)]" />
                  Analysis
                </span>
                <span>Engine review</span>
              </div>
              <div className="review-position-card">
                <p>{displayPly === 0 ? "Starting position" : `Position after ${activeReviewMove?.notation ?? "latest move"}`}</p>
                <strong>{activeReviewMove ? `${activeReviewMove.label} - ${activeReviewMove.score}/100` : "Ready for review"}</strong>
                <span>{activeReviewMove?.detail ?? "Use Game Review to replay positions with move quality labels."}</span>
                {activeReviewMove ? <small>Best line: {activeReviewMove.bestLine}</small> : null}
              </div>
              <ol className="review-move-list move-list max-h-52 overflow-auto text-sm">
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
              <button type="button" title="Open move-by-move review mode." onClick={startReview} className="focus-ring review-primary-button">
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
          ) : null}
        </div>
      </aside>
      {showRules && rulesSummary ? (
        <div className="rules-modal-backdrop" role="presentation" onClick={() => setShowRules(false)}>
          <section className="rules-modal panel" role="dialog" aria-label="Basic rules" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Basic rules</p>
                <h2>{rulesSummary.variantKey}</h2>
              </div>
              <button type="button" title="Close rules" onClick={() => setShowRules(false)} className="focus-ring action-secondary px-3 py-2 text-sm">
                Close
              </button>
            </div>
            <ol className="rules-numbered-list">
              {rulesSummary.numberedBasics.map((rule, index) => (
                <li key={rule}>
                  <span>{index + 1}</span>
                  <p>{rule}</p>
                </li>
              ))}
            </ol>
            <div className="rules-modal-grid">
              <p>
                <strong>Win:</strong> {rulesSummary.winConditions.join("; ")}
              </p>
              <p>
                <strong>Draw:</strong> {rulesSummary.drawConditions.join("; ")}
              </p>
              <p>
                <strong>Illegal:</strong> {rulesSummary.illegalMoveNotes.join("; ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rulesSummary.sourceLinks.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--muted)]">
                  {source.name}
                </a>
              ))}
            </div>
          </section>
        </div>
      ) : null}
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

function pickHumanColor(state: GameState, choice: SeatChoice) {
  const first = state.clocks[0]?.color ?? "white";
  const second = state.clocks[1]?.color ?? "black";
  if (choice === "first") return first;
  if (choice === "second") return second;
  return Math.random() > 0.5 ? first : second;
}

function colorLabel(color: string) {
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

function formatMove(from: Square, to: Square, files: string[], rows: number) {
  return `${squareName(from, files, rows)} to ${squareName(to, files, rows)}`;
}

function squareName(square: Square, files: string[], rows: number) {
  return `${files[square.col] ?? square.col}${rows - square.row}`;
}

function quickSuggestionMove(state: GameState) {
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

function uciSquare(square: string): Square {
  return {
    row: 8 - Number(square[1]),
    col: square.charCodeAt(0) - 97
  };
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
