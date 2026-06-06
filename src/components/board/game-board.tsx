"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bot,
  Brain,
  Crown,
  PauseCircle,
  PlayCircle,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Swords,
  Undo2,
  X,
} from "lucide-react";

import { botDifficultyLevels, MAX_BOT_REPLY_MS, type BotDifficultyKey } from "@/lib/bot/config";
import { getVariantBotStrengthProfile } from "@/lib/bot/strength";
import type { BotMoveResult } from "@/lib/bot/runtime";
import { getCatalogModeSupport, getGameCatalogEntry, type CatalogModeSupport } from "@/lib/catalog";
import { applyBotMoveAfterThinking, settleBotThinkingSnapshot } from "@/lib/game/bot-clock";
import { tickGameClock } from "@/lib/game/clocks";
import { redoTimeline, redoTimelineUntil, undoTimeline, undoTimelineUntil } from "@/lib/game/history";
import { analyzeMoveList, summarizeReview } from "@/lib/game/review";
import { describeGameOutcome } from "@/lib/game/outcome";
import type { VariantRuleSummary } from "@/lib/variants/rules-atlas";
import { getTimeControl, type TimeControlKey } from "@/lib/game/time-controls";
import { applyMove, createInitialState, getLegalMoves, getVariant, sameSquare, serializeSquare, type GameState, type Move, type Piece, type Square } from "@/lib/variants";
import { BoardGrid } from "@/components/board/board-grid";
import { BoardPlayerCard } from "@/components/board/board-player-card";
import { GameGuideModal } from "@/components/board/game-guide-modal";
import { MatchResultOverlay } from "@/components/board/match-result-overlay";
import { getPieceDisplayName, getPieceSkinOptions, type PieceSkinPreference } from "@/components/board/piece-icon";
import { PlayActiveSetupCard } from "@/components/board/play-active-setup-card";
import { PlayChatPanel } from "@/components/board/play-chat-panel";
import { PlayControlCard } from "@/components/board/play-control-card";
import { PlayMatchHeader } from "@/components/board/play-match-header";
import { PlayPregameSetupCard } from "@/components/board/play-pregame-setup-card";
import { playModeOptions, type PanelTab, type PlayMode } from "@/components/board/game-board-options";
import { colorLabel, formatMove, pickHumanColor, quickSuggestionMove, withTimeControl } from "@/components/board/game-board-utils";
import { PlaySectionTabs } from "@/components/board/play-section-tabs";

type BotMode = "human" | "opponent" | "both";
type SeatChoice = "random" | "first" | "second";
type BoardOrientation = "auto" | "first" | "second";
const pieceSkinStoragePrefix = "allchess-piece-skin:";

function initialPieceSkinPreference(variantKey: string): PieceSkinPreference {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(`${pieceSkinStoragePrefix}${variantKey}`) as PieceSkinPreference | null;
  return stored && getPieceSkinOptions(variantKey).some((option) => option.key === stored) ? stored : "default";
}

type ThinkingState = {
  status: "idle" | "thinking" | "cancelled" | "failed";
  label: string;
};

type SuggestedMove = {
  from: Square;
  to: Square;
  promotion?: boolean;
  notation: string;
  score: number | null;
  depthReached: number;
};

type PendingPromotion = {
  keepMove: Move;
  promoteMove: Move;
  pieceLabel: string;
};

type DropSelectionHintProps = {
  legalTargetCount: number;
  onCancel: () => void;
  pieceLabel: string;
};

export function DropSelectionHint({ legalTargetCount, onCancel, pieceLabel }: DropSelectionHintProps) {
  return (
    <div className="drop-selection-card" role="status" aria-label={`Dropping ${pieceLabel}`}>
      <span>
        <strong>Drop {pieceLabel}</strong>
        <small>{legalTargetCount ? `${legalTargetCount} legal ${legalTargetCount === 1 ? "square" : "squares"}` : "No legal squares"}</small>
      </span>
      <button type="button" className="focus-ring" aria-label={`Cancel ${pieceLabel} drop`} onClick={onCancel}>
        <X size={14} />
        <span>Cancel</span>
      </button>
    </div>
  );
}

function resolveSupportedPlayMode(variantKey: string, requestedMode: PlayMode): PlayMode {
  const entry = getGameCatalogEntry(variantKey);
  if (!entry) return requestedMode;
  if (getCatalogModeSupport(entry, requestedMode).enabled) return requestedMode;
  return getCatalogModeSupport(entry, "offline").enabled ? "offline" : "spectate";
}

function unavailableModeSupport(mode: PlayMode): CatalogModeSupport {
  return {
    enabled: false,
    level: "guide-only",
    mode,
    reason: "This game needs a catalog entry before the mode can be started."
  };
}

function createHandDropPiece(owner: Piece["owner"], code: string): Piece {
  return {
    id: `${owner}-${code}-hand`,
    code,
    owner,
    labelKey: `piece.${code}`
  };
}

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
  locale = "en",
  title = "Game"
}: {
  variantKey: string;
  initialState?: GameState;
  rulesSummary?: VariantRuleSummary;
  initialBotMode?: BotMode;
  initialBotDifficulty?: BotDifficultyKey;
  initialPlayMode?: PlayMode;
  initialTimeControl?: TimeControlKey;
  locale?: string;
  title?: string;
}) {
  const [timeControl, setTimeControl] = useState<TimeControlKey>(initialTimeControl);
  const [state, setState] = useState(() => withTimeControl(initialState ?? createInitialState(variantKey), initialTimeControl));
  const [history, setHistory] = useState<GameState[]>([]);
  const [future, setFuture] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [selectedHandCode, setSelectedHandCode] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>(() => resolveSupportedPlayMode(variantKey, initialPlayMode ?? (initialBotMode === "opponent" ? "bot" : "offline")));
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyKey>(initialBotDifficulty);
  const [botMode, setBotMode] = useState<BotMode>(initialBotMode);
  const [pieceSkin, setPieceSkinState] = useState<PieceSkinPreference>(() => initialPieceSkinPreference(variantKey));
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
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
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
  const selectedHandPiece = useMemo(() => (selectedHandCode ? createHandDropPiece(state.turn, selectedHandCode) : null), [selectedHandCode, state.turn]);
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : selectedHandPiece ? getLegalMoves(state, { drop: selectedHandPiece }) : []), [selected, selectedHandPiece, state]);
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => serializeSquare(move.to))), [legalMoves]);
  const selectedHandLabel = selectedHandCode ? getPieceDisplayName(selectedHandCode, variantKey, locale) : null;
  const botColor = state.clocks.find((clock) => clock.color !== humanColor)?.color ?? state.clocks[1]?.color ?? "black";
  const rows = displayState.board.length;
  const cols = displayState.board[0]?.length ?? 8;
  const files = useMemo(() => Array.from({ length: cols }, (_, index) => String.fromCharCode(97 + index)), [cols]);
  const botLevel = botDifficultyLevels.find((level) => level.key === botDifficulty) ?? botDifficultyLevels[1];
  const pieceSkinOptions = useMemo(() => getPieceSkinOptions(variantKey), [variantKey]);
  const supportsDrops = useMemo(() => getVariant(variantKey).supportsDrops, [variantKey]);
  const botStrength = useMemo(() => getVariantBotStrengthProfile(variantKey, botDifficulty), [botDifficulty, variantKey]);
  const botCalibrationLabel = botStrength.calibrationStatus.replace(/-/g, " ");
  const botResponseBudget = Math.min(botLevel.moveTimeMs, MAX_BOT_REPLY_MS - 180);
  const outcome = useMemo(() => describeGameOutcome(state, humanColor), [humanColor, state]);
  const outcomeKey = state.status === "completed" ? `${state.moves.length}:${state.result ?? ""}:${state.outcomeReason ?? ""}` : null;
  const firstColor = (state.clocks[0]?.color ?? "white") as Piece["owner"];
  const secondColor = (state.clocks[1]?.color ?? "black") as Piece["owner"];
  const catalogEntry = useMemo(() => getGameCatalogEntry(variantKey), [variantKey]);
  const modeSupport = useMemo(
    () => ({
      online: catalogEntry ? getCatalogModeSupport(catalogEntry, "online") : unavailableModeSupport("online"),
      bot: catalogEntry ? getCatalogModeSupport(catalogEntry, "bot") : unavailableModeSupport("bot"),
      offline: catalogEntry ? getCatalogModeSupport(catalogEntry, "offline") : unavailableModeSupport("offline"),
      room: catalogEntry ? getCatalogModeSupport(catalogEntry, "room") : unavailableModeSupport("room"),
      spectate: catalogEntry ? getCatalogModeSupport(catalogEntry, "spectate") : unavailableModeSupport("spectate")
    }),
    [catalogEntry]
  );
  const isThinking = thinking.status === "thinking";
  const isOnlineMode = playMode === "online" || playMode === "room";
  const isBotMode = playMode === "bot";
  const isSpectating = playMode === "spectate";
  const isSearchingOnline = gameStarted && isOnlineMode && state.status !== "completed";
  const isWatchingMode = gameStarted && isSpectating && state.status !== "completed";
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
  const statusHeading = isSearchingOnline
    ? "Searching for opponent"
    : isWatchingMode
      ? "Watching rooms"
      : `${colorLabel(state.turn)} to move`;
  const botSearchDetail = lastBotResult
    ? `Bot: ${lastBotResult.knowledgeSource ?? lastBotResult.engine} ${lastBotResult.depthReached}/${lastBotResult.nodesSearched}.`
    : isBotMode
      ? `Bot budget: ${botResponseBudget}ms.`
      : "";
  const trimmedOpponentQuery = opponentQuery.trim();
  const topPlayerColor = isBoardFlipped ? firstColor : secondColor;
  const bottomPlayerColor = isBoardFlipped ? secondColor : firstColor;
  const capturedBy = useCallback(
    (color: string) => state.captured.filter((piece) => piece.owner !== color),
    [state.captured]
  );

  function playerCard(color: Piece["owner"], placement: "top" | "bottom") {
    const handCounts = state.hands?.[color] ?? {};
    const canUseHand = canHumanMove(color) && Object.values(handCounts).some((count) => count > 0);
    return (
      <BoardPlayerCard
        botLevelLabel={botLevel.label}
        botModeActive={color === botColor && botMode !== "human"}
        botStrengthDisplay={botStrength.display}
        canUseHand={canUseHand}
        capturedPieces={capturedBy(color)}
        handCounts={handCounts}
        opponentCapturedPieces={state.captured.filter((piece) => piece.owner === color)}
        clock={state.clocks.find((entry) => entry.color === color)}
        color={color}
        humanColor={humanColor}
        isActive={state.turn === color}
        locale={locale}
        onHandPieceClick={(code) => chooseHandPiece(color, code)}
        pieceSkin={pieceSkin}
        placement={placement}
        selectedHandCode={color === state.turn ? selectedHandCode : null}
        supportsDrops={supportsDrops}
        thinking={thinking.status === "thinking"}
        timeControl={timeControl}
        variantKey={displayState.variantKey}
      />
    );
  }

  function canHumanMove(color: Piece["owner"] = state.turn) {
    return (
      gameStarted &&
      state.status === "active" &&
      !isReviewing &&
      !isThinking &&
      !isOnlineMode &&
      !isSpectating &&
      color === state.turn &&
      botMode !== "both" &&
      !(botMode === "opponent" && state.turn !== humanColor)
    );
  }

  function changePieceSkin(nextSkin: PieceSkinPreference) {
    const validSkin = pieceSkinOptions.some((option) => option.key === nextSkin) ? nextSkin : "default";
    setPieceSkinState(validSkin);
    window.localStorage.setItem(`${pieceSkinStoragePrefix}${variantKey}`, validSkin);
  }

  function commitPlayerMove(move: Move) {
    setHistory((current) => [...current, state]);
    setFuture([]);
    setState((current) => applyMove(current, move));
    setSuggestedMove(null);
    setNotice(null);
    setReviewPly(null);
    setReviewPlaying(false);
    setSelected(null);
    setSelectedHandCode(null);
    setPendingPromotion(null);
  }

  function commitMoveChoice(candidates: Move[], piece?: Piece | null) {
    const promoteMove = candidates.find((candidate) => candidate.promotion === true);
    const keepMove = candidates.find((candidate) => candidate.promotion !== true);
    if (promoteMove && keepMove && piece) {
      setPendingPromotion({
        keepMove,
        promoteMove,
        pieceLabel: getPieceDisplayName(piece.code, variantKey, locale, piece.promoted)
      });
      setNotice(null);
      return true;
    }
    commitPlayerMove(promoteMove ?? keepMove ?? candidates[0]);
    return true;
  }

  function chooseHandPiece(color: Piece["owner"], code: string) {
    if (!canHumanMove(color)) return;
    setSelected(null);
    setSelectedHandCode((current) => (current === code ? null : code));
    setNotice(null);
    setPendingPromotion(null);
  }

  function cancelHandDrop() {
    setSelectedHandCode(null);
    setNotice(null);
  }

  function dropHandPiece(code: string, target: Square) {
    if (!canHumanMove()) return false;
    const dropPiece = createHandDropPiece(state.turn, code);
    const move = getLegalMoves(state, { drop: dropPiece }).find((candidate) => sameSquare(candidate.to, target));
    if (!move) {
      setSelected(null);
      setSelectedHandCode(code);
      setNotice("That drop is not legal for this piece.");
      return false;
    }
    commitPlayerMove(move);
    return true;
  }

  function dragBoardMove(from: Square, to: Square) {
    if (!canHumanMove()) return false;
    const candidates = getLegalMoves(state, from).filter((candidate) => sameSquare(candidate.to, to));
    if (!candidates.length) {
      setSelected(from);
      setSelectedHandCode(null);
      setPendingPromotion(null);
      setNotice("That move is not legal.");
      return false;
    }
    const piece = state.board[from.row]?.[from.col]?.piece ?? null;
    commitMoveChoice(candidates, piece);
    return true;
  }

  function choose(square: Square) {
    if (!gameStarted) {
      setNotice("Choose a mode and press Start Game first.");
      setPanelTab("setup");
      setPendingPromotion(null);
      return;
    }
    if (isReviewing) {
      setNotice("Review mode is showing a saved position. Jump to live to keep playing.");
      setPendingPromotion(null);
      return;
    }
    if (isOnlineMode) {
      setNotice("Searching for opponent. Board moves unlock after a live opponent is paired.");
      setPanelTab("status");
      setPendingPromotion(null);
      return;
    }
    if (isSpectating) {
      setNotice("Spectate mode is read-only. Choose a playable mode to move pieces.");
      setPanelTab("status");
      setPendingPromotion(null);
      return;
    }
    if (state.status === "completed" || thinking.status === "thinking") return;
    if (botMode === "both" || (botMode === "opponent" && state.turn !== humanColor)) {
      setNotice(botMode === "both" ? "Both bots are controlling the board." : "Bot is to move. You can change sides or cancel bot mode.");
      setPendingPromotion(null);
      return;
    }
    if (selectedHandPiece) {
      const move = legalMoves.find((candidate) => sameSquare(candidate.to, square));
      if (move) {
        commitPlayerMove(move);
      } else {
        setNotice("That drop is not legal for this piece.");
      }
      return;
    }
    if (selected && legalTargets.has(serializeSquare(square))) {
      const candidates = legalMoves.filter((candidate) => sameSquare(candidate.to, square));
      if (candidates.length) {
        const piece = state.board[selected.row]?.[selected.col]?.piece ?? null;
        commitMoveChoice(candidates, piece);
      }
      return;
    }

    const cell = state.board[square.row]?.[square.col];
    setPendingPromotion(null);
    setSelectedHandCode(null);
    setSelected(cell?.piece?.owner === state.turn ? square : null);
  }

  function choosePromotion(promote: boolean) {
    if (!pendingPromotion) return;
    commitPlayerMove(promote ? pendingPromotion.promoteMove : pendingPromotion.keepMove);
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
      setSelectedHandCode(null);
      setPendingPromotion(null);
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
        promotion: quickMove.promotion,
        notation: formatMove(quickMove, files, rows),
        score: null,
        depthReached: 0
      });
      setSelected(quickMove.from);
      setSelectedHandCode(null);
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
      promotion: result.move.promotion,
      notation: formatMove(result.move, files, rows),
      score: result.score,
      depthReached: result.depthReached
    });
    setSelected(result.move.from);
    setSelectedHandCode(null);
    setNotice(null);
  }

  function applySuggestion() {
    if (!suggestedMove) return;
    const move = getLegalMoves(state, suggestedMove.from).find((candidate) => matchesSuggestedMove(candidate, suggestedMove));
    if (!move) {
      setNotice("That suggestion is no longer legal.");
      setSuggestedMove(null);
      return;
    }
    setHistory((current) => [...current, state]);
    setFuture([]);
    setState((current) => applyMove(current, move));
    setSelected(null);
    setSelectedHandCode(null);
    setPendingPromotion(null);
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
    setSelectedHandCode(null);
    setPendingPromotion(null);
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
    setSelectedHandCode(null);
    setPendingPromotion(null);
    setSuggestedMove(null);
    setShowOutcome(true);
    setNotice("Resignation recorded.");
  }

  function undo() {
    const shouldStepPlayerTurn = isBotMode && botMode === "opponent";
    const next = shouldStepPlayerTurn
      ? undoTimelineUntil(history, state, future, (candidate) => candidate.turn === humanColor)
      : undoTimeline(history, state, future);
    if (!next) return;
    setHistory(next.past);
    setFuture(next.future);
    setState(next.present);
    setSelected(null);
    setSelectedHandCode(null);
    setPendingPromotion(null);
    setSuggestedMove(null);
    setLastBotResult(null);
    setNotice(null);
    setReviewPly(null);
    setReviewPlaying(false);
  }

  function redo() {
    const shouldStepPlayerTurn = isBotMode && botMode === "opponent";
    const next = shouldStepPlayerTurn
      ? redoTimelineUntil(history, state, future, (candidate) => candidate.turn === humanColor)
      : redoTimeline(history, state, future);
    if (!next) return;
    setHistory(next.past);
    setFuture(next.future);
    setState(next.present);
    setSelected(null);
    setSelectedHandCode(null);
    setPendingPromotion(null);
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
    setSelectedHandCode(null);
    setPendingPromotion(null);
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
    setSelectedHandCode(null);
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
    if (!modeSupport[playMode].enabled) {
      setNotice(modeSupport[playMode].reason);
      return;
    }
    const nextColor = pickHumanColor(state, seatChoice);
    resolvedRandomSeatRef.current = true;
    setHumanColor(nextColor);
    setBotMode(isBotMode ? "opponent" : "human");
    setBoardOrientation("auto");
    setSelected(null);
    setSelectedHandCode(null);
    setLastBotResult(null);
    setGameStarted(true);
    setState((current) => (isOnlineMode || isSpectating ? { ...current, status: "waiting" } : { ...current, status: "active" }));
    setPanelTab("status");
    setNotice(
      isOnlineMode
        ? `Searching for opponent in ${modeDetails.label}. You will play ${colorLabel(nextColor)} when paired.`
        : isSpectating
          ? "Spectate mode is read-only. Watch rooms without moving pieces."
          : null
    );
  }

  function selectPlayMode(nextMode: PlayMode) {
    if (!modeSupport[nextMode].enabled) {
      setNotice(modeSupport[nextMode].reason);
      return;
    }
    setPlayMode(nextMode);
    setOpponentQuery("");
    setSelected(null);
    setSelectedHandCode(null);
    if (nextMode !== "bot") {
      setBotMode("human");
      setLastBotResult(null);
    }
    if (nextMode === "online" || nextMode === "room") {
      setNotice("Online play selected. Bot controls are disabled while player pairing or room setup is active.");
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
    setSelectedHandCode(null);
    setSuggestedMove(null);
    setNotice("Review mode opened. Use playback controls to inspect each position.");
  }

  function jumpToLive() {
    setReviewPly(null);
    setReviewPlaying(false);
    setSelectedHandCode(null);
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
    setSelectedHandCode(null);
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
      if (!gameStarted || isSearchingOnline || isWatchingMode) return;
      setState((current) => tickGameClock(current, elapsed));
    }, 250);
    return () => window.clearInterval(timer);
  }, [gameStarted, isSearchingOnline, isWatchingMode]);

  return (
    <div className="game-board-layout grid gap-4">
      <div className="board-column grid gap-3">
        {playerCard(topPlayerColor, "top")}
        <div className="board-shell" data-variant={displayState.variantKey} data-variant-size={`${cols}x${rows}`} style={{ "--board-cols": cols, "--board-rows": rows } as CSSProperties}>
          <div className="board-stage">
            <BoardGrid cols={cols} files={files} legalTargets={legalTargets} legalTargetMode={selectedHandPiece ? "drop" : "move"} locale={locale} onChoose={choose} onDragMove={dragBoardMove} onDropHandPiece={dropHandPiece} orientedRows={orientedRows} pieceSkin={pieceSkin} rows={rows} selected={selected} suggestedMove={suggestedMove} variantKey={displayState.variantKey} />
            {selectedHandLabel ? <DropSelectionHint legalTargetCount={legalTargets.size} onCancel={cancelHandDrop} pieceLabel={selectedHandLabel} /> : null}
            {pendingPromotion ? (
              <div className="promotion-choice-card" role="dialog" aria-label={`${pendingPromotion.pieceLabel} promotion choice`}>
                <strong>{pendingPromotion.pieceLabel}</strong>
                <div>
                  <button type="button" className="focus-ring" onClick={() => choosePromotion(true)}>
                    Promote
                  </button>
                  <button type="button" className="focus-ring" onClick={() => choosePromotion(false)}>
                    Keep
                  </button>
                </div>
              </div>
            ) : null}
            {!gameStarted ? (
              <div className="pregame-board-overlay" role="status">
                <strong>Choose setup first</strong>
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
          currentVariantKey={variantKey}
          locale={locale}
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
          playMode={playMode}
          showGuide={Boolean(rulesSummary)}
          timeControl={timeControl}
          title={title}
        />
        <PlaySectionTabs activeTab={panelTab} onChange={setPanelTab} />
        <div className="play-tab-panel">
          {panelTab === "setup" ? (
            gameStarted ? (
              <PlayActiveSetupCard modeLabel={modeDetails.label} onReset={reset} onShowStatus={() => setPanelTab("status")} timeControlLabel={getTimeControl(timeControl).label} />
            ) : (
              <PlayPregameSetupCard
                botDifficulty={botDifficulty}
                botLevelLabel={botLevel.label}
                botStrengthDisplay={botStrength.display}
                botStrengthLabel={botCalibrationLabel}
                botTargetElo={botStrength.targetElo}
                firstColorLabel={colorLabel(firstColor)}
                isBotMode={isBotMode}
                onBotDifficultyChange={setBotDifficulty}
                onModeChange={selectPlayMode}
                onSeatChoiceChange={changeSeatChoice}
                onStartGame={startGame}
                onTimeControlChange={changeTimeControl}
                playMode={playMode}
                modeSupport={modeSupport}
                seatChoice={seatChoice}
                secondColorLabel={colorLabel(secondColor)}
                timeControl={timeControl}
              />
            )
          ) : null}
          {panelTab === "status" ? (
            <div className="grid gap-3">
              <PlayControlCard
                botLevelLabel={botLevel.label}
                botMode={botMode}
                canEndGame={canEndGame}
                canRedo={canRedo}
                canUndo={canUndo}
                canUseAssist={canUseAssist}
                canUseBots={canUseBots}
                gameStarted={gameStarted}
                isThinking={isThinking}
                onApplySuggestion={applySuggestion}
                onCancelThinking={cancelThinking}
                onFlipBoard={flipBoard}
                onMoveForCurrentSide={() => void playBotMove("manual")}
                onOfferDraw={offerDraw}
                onPieceSkinChange={changePieceSkin}
                onRedo={redo}
                onResign={resignGame}
                onReset={reset}
                onSuggest={suggestMove}
                onToggleAuto={() => setBotMode((current) => (current === "both" ? "human" : "both"))}
                onToggleBot={() => {
                  setBotMode((current) => {
                    const next = current === "opponent" ? "human" : "opponent";
                    setNotice(next === "opponent" ? "Bot opponent is on. Make a move and the bot will reply automatically." : "Bot opponent is off.");
                    setPanelTab("status");
                    return next;
                  });
                }}
                onUndo={undo}
                pieceSkin={pieceSkin}
                pieceSkinOptions={pieceSkinOptions}
                suggestedMoveReady={Boolean(suggestedMove)}
              />
              <div className="play-table-card">
                {thinking.status === "thinking" ? <p className="mt-1 text-sm font-bold text-[var(--info)]">{thinking.label}</p> : null}
                {isOnlineMode ? (
                  <div className="online-search-card" role="status" aria-label="Online matchmaking status">
                    <Swords size={18} />
                    <div>
                      <strong>{isSearchingOnline ? "Searching for opponent" : "Online opponent required"}</strong>
                      <span>{isSearchingOnline ? "Bots paused while matching." : "Start search from setup."}</span>
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
                    <label className="bot-profile-card bot-profile-card-with-select">
                      <Bot size={18} />
                      <div>
                        <strong>{botLevel.label} bot</strong>
                        <span title={botStrength.basis}>{botStrength.display} - {botCalibrationLabel}</span>
                      </div>
                      <small title={botStrength.basis}>target {botStrength.targetElo}</small>
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
                    </div>
                  </div>
                )}
                {suggestedMove ? (
                  <p className="play-status-note text-[var(--accent-strong)]">
                    Suggestion: {suggestedMove.notation} - depth {suggestedMove.depthReached}
                  </p>
                ) : null}
                {notice ? <p className="play-status-note text-[var(--warning)]">{notice}</p> : null}
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
              <div className={`review-position-card ${activeReviewMove ? "" : "is-live"}`}>
                {activeReviewMove ? (
                  <>
                    <p>{`After ${activeReviewMove.notation}`}</p>
                    <strong>{`${activeReviewMove.label} - ${activeReviewMove.score}/100`}</strong>
                    <span>{activeReviewMove.detail}</span>
                    <small>Best line: {activeReviewMove.bestLine}{botSearchDetail ? ` ${botSearchDetail}` : ""}</small>
                  </>
                ) : (
                  <>
                    <strong>{statusHeading}</strong>
                    {botSearchDetail ? <span>{botSearchDetail}</span> : null}
                  </>
                )}
              </div>
              <ol className="review-move-list move-list text-sm">
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
        <PlayChatPanel key={playMode} gameStarted={gameStarted} isSpectating={isSpectating} playMode={playMode} title={title} />
      </aside>
      <GameGuideModal show={showRules} rulesSummary={rulesSummary} onClose={() => setShowRules(false)} />
    </div>
  );
}

function matchesSuggestedMove(candidate: Move, suggestedMove: SuggestedMove) {
  if (!sameSquare(candidate.to, suggestedMove.to)) return false;
  if (suggestedMove.promotion === undefined) return true;
  return Boolean(candidate.promotion) === suggestedMove.promotion;
}
