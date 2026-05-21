"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bot,
  Brain,
  Crown,
  Flag,
  FlipHorizontal2,
  Handshake,
  Lightbulb,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Timer,
  Undo2,
  Redo2,
} from "lucide-react";

import { botDifficultyLevels, MAX_BOT_REPLY_MS, type BotDifficultyKey } from "@/lib/bot/config";
import { getVariantBotStrengthProfile } from "@/lib/bot/strength";
import type { BotMoveResult } from "@/lib/bot/runtime";
import { applyBotMoveAfterThinking, settleBotThinkingSnapshot } from "@/lib/game/bot-clock";
import { tickGameClock } from "@/lib/game/clocks";
import { redoTimeline, undoTimeline } from "@/lib/game/history";
import { analyzeMoveList, summarizeReview } from "@/lib/game/review";
import { describeGameOutcome } from "@/lib/game/outcome";
import type { VariantRuleSummary } from "@/lib/variants/rules-atlas";
import { getTimeControl, timeControls, type TimeControlKey } from "@/lib/game/time-controls";
import { applyMove, createInitialState, getLegalMoves, sameSquare, serializeSquare, type GameState, type Square } from "@/lib/variants";
import { BoardGrid } from "@/components/board/board-grid";
import { BoardPlayerCard } from "@/components/board/board-player-card";
import { GameGuideModal } from "@/components/board/game-guide-modal";
import { MatchResultOverlay } from "@/components/board/match-result-overlay";
import { PlayActiveSetupCard } from "@/components/board/play-active-setup-card";
import { PlayMatchHeader } from "@/components/board/play-match-header";
import { playModeOptions, type PanelTab, type PlayMode } from "@/components/board/game-board-options";
import { colorLabel, formatMove, pickHumanColor, quickSuggestionMove, withTimeControl } from "@/components/board/game-board-utils";
import { PlaySectionTabs } from "@/components/board/play-section-tabs";

type BotMode = "human" | "opponent" | "both";
type SeatChoice = "random" | "first" | "second";
type BoardOrientation = "auto" | "first" | "second";

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

async function requestRuntimeBotMove(...args: Parameters<typeof import("@/lib/bot/runtime").requestBotMove>) {
  const { requestBotMove } = await import("@/lib/bot/runtime");
  return requestBotMove(...args);
}

function cancelRuntimeBotMove(requestId: string) {
  void import("@/lib/bot/runtime").then(({ cancelBotMove }) => cancelBotMove(requestId));
}

export function GameBoard({
  variantKey,
  initialState,
  rulesSummary,
  initialBotMode = "human",
  initialBotDifficulty = "normal",
  initialPlayMode,
  initialTimeControl = "rapid",
  title = "Game",
  meta = "AllChess",
  objective = "Play a legal game."
}: {
  variantKey: string;
  initialState?: GameState;
  rulesSummary?: VariantRuleSummary;
  initialBotMode?: BotMode;
  initialBotDifficulty?: BotDifficultyKey;
  initialPlayMode?: PlayMode;
  initialTimeControl?: TimeControlKey;
  title?: string;
  meta?: string;
  objective?: string;
}) {
  const [timeControl, setTimeControl] = useState<TimeControlKey>(initialTimeControl);
  const [state, setState] = useState(() => withTimeControl(initialState ?? createInitialState(variantKey), initialTimeControl));
  const [history, setHistory] = useState<GameState[]>([]);
  const [future, setFuture] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>(initialPlayMode ?? (initialBotMode === "opponent" ? "bot" : "offline"));
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyKey>(initialBotDifficulty);
  const [botMode, setBotMode] = useState<BotMode>(initialBotMode);
  const [seatChoice, setSeatChoice] = useState<SeatChoice>("random");
  const [boardOrientation, setBoardOrientation] = useState<BoardOrientation>("auto");
  const [humanColor, setHumanColor] = useState(() => pickHumanColor(withTimeControl(initialState ?? createInitialState(variantKey), initialTimeControl), "first"));
  const [thinking, setThinking] = useState<ThinkingState>({ status: "idle", label: "" });
  const [suggestedMove, setSuggestedMove] = useState<SuggestedMove | null>(null);
  const [lastBotResult, setLastBotResult] = useState<BotMoveResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("setup");
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [opponentQuery, setOpponentQuery] = useState("");
  const activeBotRequestRef = useRef<string | null>(null);
  const resolvedRandomSeatRef = useRef(false);
  const outcomeModalKeyRef = useRef<string | null>(null);

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
  const outcomeKey = state.status === "completed" ? `${state.moves.length}:${state.result ?? ""}:${state.outcomeReason ?? ""}` : null;
  const firstColor = state.clocks[0]?.color ?? "white";
  const secondColor = state.clocks[1]?.color ?? "black";
  const isThinking = thinking.status === "thinking";
  const isOnlineMode = playMode === "online" || playMode === "matchmaking" || playMode === "room";
  const isBotMode = playMode === "bot";
  const isSpectating = playMode === "spectate";
  const isSearchingOnline = gameStarted && isOnlineMode && state.status === "active";
  const isWatchingMode = gameStarted && isSpectating && state.status === "active";
  const canUseAssist = gameStarted && state.status === "active" && !isThinking && !isReviewing && !isOnlineMode && !isSpectating;
  const canUseBots = gameStarted && state.status === "active" && isBotMode && !isThinking && !isReviewing && !isOnlineMode && !isSpectating;
  const canUndo = history.length > 0 && !isThinking && !isReviewing && !isOnlineMode && !isSpectating;
  const canRedo = future.length > 0 && !isThinking && !isReviewing && !isOnlineMode && !isSpectating;
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
    : isWatchingMode
      ? "Watching rooms..."
      : thinking.status === "thinking"
        ? thinking.label
        : gameStarted
          ? `${colorLabel(state.turn)} to move`
          : "Choose setup";
  const statusHeading = isSearchingOnline
    ? "Searching for opponent"
    : isWatchingMode
      ? "Watching rooms"
      : `${colorLabel(state.turn)} to move`;
  const modeSummary = gameStarted ? `${modeDetails.label} - ${getTimeControl(timeControl).label}` : `${modeDetails.label} setup`;
  const trimmedOpponentQuery = opponentQuery.trim();
  const topPlayerColor = isBoardFlipped ? firstColor : secondColor;
  const bottomPlayerColor = isBoardFlipped ? secondColor : firstColor;
  const capturedBy = useCallback(
    (color: string) => state.captured.filter((piece) => piece.owner !== color),
    [state.captured]
  );

  function playerCard(color: string, placement: "top" | "bottom") {
    return (
      <BoardPlayerCard
        botCalibrationLabel={botCalibrationLabel}
        botLevelLabel={botLevel.label}
        botModeActive={color === botColor && botMode !== "human"}
        botStrengthDisplay={botStrength.display}
        capturedPieces={capturedBy(color)}
        clock={state.clocks.find((entry) => entry.color === color)}
        color={color}
        humanColor={humanColor}
        isActive={state.turn === color}
        placement={placement}
        thinking={thinking.status === "thinking"}
        timeControl={timeControl}
        variantKey={displayState.variantKey}
      />
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
    if (isSpectating) {
      setNotice("Spectate mode is read-only. Choose a playable mode to move pieces.");
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
        setFuture([]);
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
      const historySnapshot = settleBotThinkingSnapshot(snapshot, result.elapsedMs);
      setLastBotResult(result);
      setHistory((current) => [...current, historySnapshot]);
      setFuture([]);
      setState((current) => applyBotMoveAfterThinking(current, snapshot, move, result.elapsedMs));
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
    setFuture([]);
    setState((current) => applyMove(current, move));
    setSelected(null);
    setSuggestedMove(null);
    setLastBotResult(null);
    setNotice("Suggestion applied.");
    setPanelTab("status");
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
    setFuture([]);
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
    setFuture([]);
    setThinking({ status: "idle", label: "" });
    setSelected(null);
    setSuggestedMove(null);
    setShowOutcome(true);
    setNotice("Resignation recorded.");
  }

  function undo() {
    const next = undoTimeline(history, state, future);
    if (!next) return;
    setHistory(next.past);
    setFuture(next.future);
    setState(next.present);
    setSelected(null);
    setSuggestedMove(null);
    setLastBotResult(null);
    setNotice(null);
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function redo() {
    const next = redoTimeline(history, state, future);
    if (!next) return;
    setHistory(next.past);
    setFuture(next.future);
    setState(next.present);
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
    setFuture([]);
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
    setFuture([]);
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
    setBotMode(isBotMode ? "opponent" : "human");
    setBoardOrientation("auto");
    setLastBotResult(null);
    setGameStarted(true);
    setPanelTab("status");
    setNotice(
      isOnlineMode
        ? `Searching for opponent in ${modeDetails.label}. You will play ${colorLabel(nextColor)} when paired.`
        : isSpectating
          ? "Spectate mode is read-only. Watch rooms without moving pieces."
          : `${modeDetails.label} started. You are playing ${colorLabel(nextColor)}.`
    );
  }

  function selectPlayMode(nextMode: PlayMode) {
    setPlayMode(nextMode);
    setOpponentQuery("");
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

  function searchOpponent() {
    if (!trimmedOpponentQuery) return;
    setPanelTab("status");
    setNotice(`Searching for ${trimmedOpponentQuery}. Live player results will appear here when Cloudflare presence reports a match.`);
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
    if (!outcomeKey) {
      outcomeModalKeyRef.current = null;
      return;
    }
    if (outcomeModalKeyRef.current === outcomeKey) return;
    outcomeModalKeyRef.current = outcomeKey;
    setShowOutcome(true);
  }, [outcomeKey]);

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
            <BoardGrid cols={cols} files={files} legalTargets={legalTargets} onChoose={choose} orientedRows={orientedRows} rows={rows} selected={selected} suggestedMove={suggestedMove} variantKey={displayState.variantKey} />
            {!gameStarted ? (
              <div className="pregame-board-overlay" role="status">
                <strong>Choose setup first</strong>
                <span>{modeDetails.label} · {getTimeControl(timeControl).label} · {seatChoice === "random" ? "Random side" : colorLabel(humanColor)}</span>
              </div>
            ) : null}
            {outcome && !isReviewing ? (
              <MatchResultOverlay
                outcome={outcome}
                showModal={showOutcome}
                onClose={() => setShowOutcome(false)}
                onPlayAgain={reset}
                onReview={() => {
                  setShowOutcome(false);
                  startReview();
                }}
              />
            ) : null}
          </div>
        </div>
        {playerCard(bottomPlayerColor, "bottom")}
      </div>

      <aside className="game-side-panel play-panel grid content-start gap-4 p-4">
        <PlayMatchHeader
          meta={meta}
          modeSummary={modeSummary}
          objective={objective}
          onOpenGuide={() => setShowRules(true)}
          onSelectRoom={() => {
            selectPlayMode("room");
            setPanelTab("setup");
            setNotice("Room setup selected. Bot controls are disabled while waiting for a player.");
          }}
          onSelectWatch={() => {
            selectPlayMode("spectate");
            setPanelTab("setup");
          }}
          phaseLabel={phaseLabel}
          showGuide={Boolean(rulesSummary)}
          title={title}
        />
        <PlaySectionTabs activeTab={panelTab} onChange={setPanelTab} />
        <div className="play-tab-panel">
          {panelTab === "setup" ? (
            gameStarted ? (
              <PlayActiveSetupCard humanColorLabel={colorLabel(humanColor)} modeLabel={modeDetails.label} onReset={reset} onShowStatus={() => setPanelTab("status")} timeControlLabel={getTimeControl(timeControl).label} />
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
                <label className={`play-setup-field ${!isBotMode ? "is-disabled" : ""}`} title={isBotMode ? "Choose how strong the bot should be." : "Bot difficulty is only used in Bot Mode."}>
                  <span>Bot difficulty</span>
                  <select aria-label="Bot difficulty" value={botDifficulty} onChange={(event) => setBotDifficulty(event.target.value as BotDifficultyKey)} disabled={!isBotMode}>
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
                <div className="play-control-groups" aria-label="Board command groups">
                  <section className="play-control-section" aria-label="Assist controls">
                    <div className="play-control-group-label">
                      <span>Assist</span>
                      <small>Suggest or move</small>
                    </div>
                    <div className="play-control-group play-control-group-primary">
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
                        <Lightbulb size={15} />
                        <span>Suggest</span>
                      </button>
                      <button
                        type="button"
                        title={suggestedMove ? "Apply the highlighted suggestion to the board." : "Generate a suggestion first."}
                        aria-label="Apply move"
                        onClick={applySuggestion}
                        className="focus-ring action-primary play-control-button is-main"
                        disabled={!canUseAssist || !suggestedMove}
                      >
                        <Sparkles size={15} />
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
                        <PlayCircle size={15} />
                        <span>Move</span>
                      </button>
                    </div>
                  </section>
                  <section className="play-control-section" aria-label="Bot automation controls">
                    <div className="play-control-group-label">
                      <span>Bots</span>
                      <small>{canUseBots ? botLevel.label : "Unavailable"}</small>
                    </div>
                    <div className="play-control-group play-control-group-bots">
                      <button
                        type="button"
                        aria-label="Bot Mode"
                        title={
                          canUseBots
                            ? "Toggle bot opponent. You move your selected side; the bot replies for the other side."
                            : "Bot opponent is only available in Bot Mode during an active local game."
                        }
                        onClick={() => {
                          setBotMode((current) => {
                            const next = current === "opponent" ? "human" : "opponent";
                            setNotice(next === "opponent" ? "Bot opponent is on. Make a move and the bot will reply automatically." : "Bot opponent is off.");
                            setPanelTab("status");
                            return next;
                          });
                        }}
                        disabled={!canUseBots}
                        className={`focus-ring play-control-button ${botMode === "opponent" ? "bg-[var(--accent)] text-black" : "border border-[var(--border)] bg-[var(--surface)]"}`}
                      >
                        <Bot size={15} />
                        <span>Bot</span>
                      </button>
                      <button
                        type="button"
                        title={canUseBots ? "Let bots control both sides until you turn this off." : "Auto is only available in Bot Mode during an active local game."}
                        onClick={() => setBotMode((current) => (current === "both" ? "human" : "both"))}
                        disabled={!canUseBots}
                        className={`focus-ring play-control-button ${botMode === "both" ? "bg-[var(--accent)] text-black" : "border border-[var(--border)] bg-[var(--surface)]"}`}
                      >
                        <Bot size={15} />
                        <span>Auto</span>
                      </button>
                    </div>
                  </section>
                  <section className="play-control-section" aria-label="Match controls">
                    <div className="play-control-group-label">
                      <span>Match</span>
                      <small>{canEndGame ? "Active game" : "Start first"}</small>
                    </div>
                    <div className="play-control-group play-control-group-match">
                      <button type="button" onClick={offerDraw} disabled={!canEndGame} className="focus-ring action-secondary play-control-button" title={canEndGame ? "End this local game as a draw." : "Draw is unavailable until an active playable game starts."}>
                        <Handshake size={15} />
                        <span>Draw</span>
                      </button>
                      <button type="button" onClick={resignGame} disabled={!canEndGame} className="focus-ring play-control-button is-danger" title={canEndGame ? "Resign the active game." : "Resign is unavailable until an active game starts."}>
                        <Flag size={15} />
                        <span>Resign</span>
                      </button>
                    </div>
                  </section>
                  <section className="play-control-section" aria-label="Utility controls">
                    <div className="play-control-group-label">
                      <span>Utility</span>
                      <small>View and history</small>
                    </div>
                    <div className="play-control-group play-control-group-utility">
                      <button type="button" title="Flip the visual board orientation without changing sides." onClick={flipBoard} className="focus-ring action-secondary play-icon-button" aria-label="Flip board">
                        <FlipHorizontal2 size={15} />
                      </button>
                      <button type="button" title={isThinking ? "Stop the current bot search." : "Cancel is available only while the bot is thinking."} onClick={cancelThinking} className="focus-ring action-secondary play-icon-button" disabled={!isThinking} aria-label="Cancel thinking">
                        <PauseCircle size={15} />
                      </button>
                      <button type="button" title={canUndo ? "Undo the last local move." : "Undo is disabled for online, room, spectate, review, thinking, or empty history states."} onClick={undo} className="focus-ring action-secondary play-icon-button" aria-label="Undo" disabled={!canUndo}>
                        <Undo2 size={15} />
                      </button>
                      <button type="button" title={canRedo ? "Redo the next local move from history." : "Redo is disabled for online, room, spectate, review, thinking, or empty future states."} onClick={redo} className="focus-ring action-secondary play-icon-button" aria-label="Redo" disabled={!canRedo}>
                        <Redo2 size={15} />
                      </button>
                      <button type="button" title="Reset the game with the current setup." onClick={reset} className="focus-ring action-secondary play-icon-button" aria-label="Reset">
                        <RotateCcw size={15} />
                      </button>
                    </div>
                  </section>
                </div>
              </div>
              <div className="play-table-card">
                <div className="compact-status-heading">
                  <div>
                    <p>Current position</p>
                    <strong>{statusHeading}</strong>
                  </div>
                  <span>{colorLabel(humanColor)} view</span>
                </div>
                {thinking.status === "thinking" ? <p className="mt-1 text-sm font-bold text-[var(--info)]">{thinking.label}</p> : null}
                {isOnlineMode ? (
                  <div className="online-search-card" role="status" aria-label="Online matchmaking status">
                    <Swords size={18} />
                    <div>
                      <strong>{isSearchingOnline ? "Searching for opponent" : "Online opponent required"}</strong>
                      <span>{isSearchingOnline ? "Bot difficulty and automation are paused while AllChess looks for a human player." : "Choose Online, Room, or Matchmaking settings, then start searching."}</span>
                      <form
                        className="opponent-search-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          searchOpponent();
                        }}
                      >
                        <label className="opponent-search-field">
                          <Search size={14} />
                          <span className="sr-only">Search opponent or room code</span>
                          <input value={opponentQuery} onChange={(event) => setOpponentQuery(event.target.value)} placeholder="Username or room code" />
                        </label>
                        <button type="submit" className="focus-ring action-secondary px-2 py-1 text-xs" disabled={!trimmedOpponentQuery} title="Search real online presence when available.">
                          Search
                        </button>
                      </form>
                      {trimmedOpponentQuery ? <span>Looking for: {trimmedOpponentQuery}</span> : null}
                    </div>
                  </div>
                ) : isBotMode ? (
                  <>
                    <div className="bot-profile-card">
                      <Bot size={18} />
                      <div>
                        <strong>{botLevel.label} bot</strong>
                        <span title={botStrength.basis}>{botStrength.display} - {botCalibrationLabel}</span>
                      </div>
                      <small title={botStrength.basis}>target {botStrength.targetElo}</small>
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
                ) : (
                  <div className="bot-profile-card status-mode-card" aria-label="Local play status">
                    <Crown size={18} />
                    <div>
                      <strong>Offline Local</strong>
                      <span>Use Suggest or Move for one-off help. Switch Setup to Bot Mode for automatic replies.</span>
                    </div>
                    <small>assist only</small>
                  </div>
                )}
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                  You: {colorLabel(humanColor)} · View: {visualOrientation === "second" ? colorLabel(secondColor) : colorLabel(firstColor)}
                </p>
                <div className="bot-stat-grid compact-bot-stat-grid" aria-label="Bot search profile">
                  <span>
                    <small>{lastBotResult ? "Source" : "Depth"}</small>
                    <strong>{lastBotResult?.knowledgeSource ?? lastBotResult?.engine ?? botLevel.depth}</strong>
                  </span>
                  <span>
                    <small>{lastBotResult ? "Search" : "Budget"}</small>
                    <strong>{lastBotResult ? `${lastBotResult.depthReached}/${lastBotResult.nodesSearched}` : `${botResponseBudget}ms`}</strong>
                  </span>
                  <span>
                    <small>View</small>
                    <strong>{visualOrientation === "second" ? colorLabel(secondColor) : colorLabel(firstColor)}</strong>
                  </span>
                </div>
                {suggestedMove ? (
                  <p className="mt-1 text-sm font-bold text-[var(--accent-strong)]">
                    Suggestion: {suggestedMove.notation} - depth {suggestedMove.depthReached}
                  </p>
                ) : null}
                {notice ? <p className="mt-1 text-sm text-[var(--warning)]">{notice}</p> : null}
              </div>
            </div>
          ) : null}
          {panelTab === "status" ? (
            <div className="play-review-card play-review-compact">
              <div className="review-engine-row">
                <span className="inline-flex items-center gap-2">
                  <Brain size={16} className="text-[var(--accent)]" />
                  Moves
                </span>
                <span>{isReviewing ? "Reviewing" : "Live"}</span>
              </div>
              <div className="review-position-card">
                <p>{displayPly === 0 ? "Starting position" : `After ${activeReviewMove?.notation ?? "latest move"}`}</p>
                <strong>{activeReviewMove ? `${activeReviewMove.label} - ${activeReviewMove.score}/100` : "Ready"}</strong>
                <span>{activeReviewMove?.detail ?? "Review opens here without hiding live status."}</span>
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
              <div className="review-inline-actions">
                <button type="button" title="Open move-by-move review mode." onClick={startReview} className="focus-ring action-secondary">
                  <Sparkles size={16} />
                  Review
                </button>
                {isReviewing ? (
                  <button type="button" onClick={jumpToLive} className="focus-ring action-secondary">
                    Back to live
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
      <GameGuideModal show={showRules} rulesSummary={rulesSummary} onClose={() => setShowRules(false)} />
    </div>
  );
}
