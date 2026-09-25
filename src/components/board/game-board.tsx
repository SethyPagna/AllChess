"use client";

import { useLocalMatch } from "./use-local-match";
import { SavedMatches } from "./saved-matches";
import { readLocalMatch } from "@/lib/game/local-match-store";
import type { LocalMatchSnapshot } from "@/lib/game/local-match";
import { downloadLocalMatch } from "@/lib/game/local-match-transfer";
import { FriendChat } from "./friend-chat";
import { MatchArrivalPanel } from "./match-arrival-panel";
import { useFriendRoom, saveFriendToken } from "./use-friend-room";
import type { FriendRoomView } from "@/lib/realtime/friend-room";
import dynamic from "next/dynamic";
import { ChoicePicker } from "./choice-buttons";
import { MakrukCountingPanel, MakrukEndgamePicker } from "./makruk-counting-panel";
import { applyMakrukCountAction, readMakrukHonorCount, makrukCountVersion, replayMakrukCountActions, usesMakrukHonorCount, type MakrukCountAction } from "@/lib/variants/makruk-counting";
import { createMakrukEndgame, makrukEndgames, type MakrukEndgameKey } from "@/lib/variants/makruk-endgames";
import { prepareMakrukBotTurn } from "@/lib/bot/makruk-counting";
import { OukCountingPanel, OukEndgamePicker } from "./ouk-counting-panel";
import { applyOukCountAction, readOukCount, type OukCountAction } from "@/lib/variants/ouk-counting";
import { prepareOukBotTurn } from "@/lib/bot/ouk-counting";
import { createOukEndgame, oukEndgames, type OukEndgameKey } from "@/lib/variants/ouk-endgames";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bot,
  Brain,
  Crown,
  PauseCircle,
  PlayCircle,
  SkipBack,
  SkipForward,
  Sparkles,
  Swords,
  Undo2,
  X,
} from "lucide-react";

import { botDifficultyLevels, getBotDifficultyLevel, MAX_BOT_REPLY_MS, type BotDifficultyKey } from "@/lib/bot/config";
import { getVariantBotStrengthProfile } from "@/lib/bot/strength";
import type { BotMoveResult } from "@/lib/bot/runtime";
import { getCatalogModeSupport, getGameCatalogEntry, type CatalogModeSupport } from "@/lib/catalog";
import { applyBotMoveAfterThinking, settleBotThinkingSnapshot } from "@/lib/game/bot-clock";
import { tickGameClock } from "@/lib/game/clocks";
import { redoTimeline, redoTimelineUntil, undoTimeline, undoTimelineUntil } from "@/lib/game/history";
import { analyzeMoveList, summarizeReview, type ReviewedMove } from "@/lib/game/review";
import { describeGameOutcome } from "@/lib/game/outcome";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVocabulary } from "@/lib/i18n/vocabulary";
import type { VariantRuleSummary } from "@/lib/variants/rules-atlas";
import { getTimeControl, type TimeControlKey } from "@/lib/game/time-controls";
import { JanggiLocalSetup, JanggiRoomSetup } from "./janggi-formation-picker";
import { copyJanggiFormations, pendingJanggiSide, readJanggiFormations, restoreJanggiOpening, withJanggiFormation, type JanggiFormation, type JanggiSide } from "@/lib/variants/janggi-formations";
import { applyMove, createInitialState, getLegalMoves, getVariant, sameSquare, serializeSquare, type GameState, type Move, type Piece, type Square } from "@/lib/variants";
import { BoardGrid } from "@/components/board/board-grid";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { BoardPlayerCard } from "@/components/board/board-player-card";
import { getDropRuleNote } from "@/components/board/drop-guidance";
import { GameGuideModal } from "@/components/board/game-guide-modal";
import { MatchResultOverlay } from "@/components/board/match-result-overlay";
import { boardThemeOptions, getAppearancePresetOptions, isAppearancePresetPreference, resolveAppearancePreset, type AppearancePresetPreference } from "@/components/board/appearance";
import { PieceIcon, getPieceDisplayName, type PieceSkinPreference } from "@/components/board/piece-icon";
import { PlayActiveSetupCard } from "@/components/board/play-active-setup-card";
import { PlayChatPanel } from "@/components/board/play-chat-panel";
import { PlayControlCard } from "@/components/board/play-control-card";
import { PlayMatchHeader } from "@/components/board/play-match-header";
import { PlayPregameSetupCard } from "@/components/board/play-pregame-setup-card";
import { playModeOptions, type PanelTab, type PlayMode } from "@/components/board/game-board-options";
import { colorLabel, formatMove, pickHumanColor, quickSuggestionMove, squareName, withTimeControl } from "@/components/board/game-board-utils";
import { PlaySectionTabs } from "@/components/board/play-section-tabs";

import { get3DCollection, isPieceFinish, type PieceFinish } from "./board-3d-config";

const Board3D = dynamic(() => import("./board-3d"), { ssr: false, loading: () => <div className="board-3d" role="status">Loading 3D board…</div> });

type BotMode = "human" | "opponent" | "both";
type SeatChoice = "random" | "first" | "second";
type BoardOrientation = "auto" | "first" | "second";
const appearanceStoragePrefix = "allchess-appearance-set:";
const guestIdentityStorageKey = "allchess-local-guest-identity";
const defaultGuestIdentity: GuestIdentity = {
  bottom: "Guest White",
  top: "Guest Black"
};

type GuestIdentity = {
  bottom: string;
  top: string;
};

function initialAppearancePreset(variantKey: string): AppearancePresetPreference {
  if (typeof window === "undefined") return "default";
  try {
    const stored = window.localStorage.getItem(`${appearanceStoragePrefix}${variantKey}`);
    return isAppearancePresetPreference(variantKey, stored) ? stored : "default";
  } catch { return "default"; }
}

function initialGuestIdentity(): GuestIdentity {
  const fallback = createGuestIdentity();
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(guestIdentityStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<GuestIdentity>;
      if (parsed.bottom && parsed.top) return { bottom: parsed.bottom, top: parsed.top };
    }
    window.localStorage.setItem(guestIdentityStorageKey, JSON.stringify(fallback));
  } catch {
    return fallback;
  }
  return fallback;
}

function createGuestIdentity(): GuestIdentity {
  return {
    bottom: `Guest ${createGuestSuffix()}`,
    top: `Guest ${createGuestSuffix()}`
  };
}

function createGuestSuffix() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 4).toUpperCase();
  return Math.random().toString(36).slice(2, 6).toUpperCase();
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
  pieceCode: string;
  pieceLabel: string;
  pieceOwner: Piece["owner"];
  promotedPieceLabel: string;
};

type MatchmakingState =
  | { status: "idle" }
  | { status: "queued"; ticketId: string }
  | { status: "matched"; roomId: string }
  | { status: "failed"; message: string };

type RoomCreationState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "ready"; roomId: string }
  | { status: "failed"; message: string };

type DropSelectionHintProps = {
  legalTargetCount: number;
  onCancel: () => void;
  pieceCode: string;
  pieceLabel: string;
  pieceOwner: Piece["owner"];
  pieceSkin: PieceSkinPreference;
  variantKey: string;
  locale: string;
};

type ReviewMoveRow = ReviewedMove & {
  owner: Piece["owner"];
  piece: Piece | null;
  pieceLabel: string;
  routeLabel: string;
  sideLabel: string;
};

function buildReviewMoveRows({
  locale,
  files,
  moves,
  rawMoves,
  rows,
  timeline,
  variantKey
}: {
  locale: string;
  files: string[];
  moves: ReviewedMove[];
  rawMoves: Array<Move & { notation: string }>;
  rows: number;
  timeline: GameState[];
  variantKey: string;
}): ReviewMoveRow[] {
  return moves.map((move) => {
    const rawMove = rawMoves[move.ply - 1];
    const beforeState = timeline[move.ply - 1] ?? timeline[0];
    const piece = rawMove ? rawMove.drop ?? findPieceAt(beforeState, rawMove.from) : null;
    const owner = piece?.owner ?? beforeState?.turn ?? "white";
    return {
      ...move,
      owner,
      piece,
      pieceLabel: piece ? getPieceDisplayName(piece.code, variantKey, locale, piece.promoted) : "Move",
      routeLabel: rawMove ? reviewRouteLabel(rawMove, files, rows) : "",
      sideLabel: colorLabel(owner)
    };
  });
}

function reviewRouteLabel(move: Move, files: string[], rows: number) {
  const target = squareName(move.to, files, rows);
  if (move.kind === "drop" || move.drop) return `Drop ${target}`;
  return `${squareName(move.from, files, rows)}-${target}${move.promotion ? "+" : ""}`;
}

function findPieceAt(state: GameState | undefined, square: Square) {
  return state?.board[square.row]?.[square.col]?.piece ?? null;
}

export function DropSelectionHint({ legalTargetCount, onCancel, pieceCode, pieceLabel, pieceOwner, pieceSkin, variantKey, locale }: DropSelectionHintProps) {
  const ruleNote = getDropRuleNote(variantKey, pieceCode);
  const legalTargetLabel = legalTargetCount ? `${legalTargetCount} legal ${legalTargetCount === 1 ? "square" : "squares"}` : "No legal squares";
  return (
    <div className="drop-selection-card" role="status" aria-label={`Dropping ${pieceLabel}. ${legalTargetLabel}. ${ruleNote}`}>
      <span className="drop-piece-preview" aria-hidden="true">
        <PieceIcon code={pieceCode} owner={pieceOwner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} />
      </span>
      <span>
        <strong>Drop {pieceLabel}</strong>
        <small>{legalTargetLabel}</small>
        <em>{ruleNote}</em>
      </span>
      <button type="button" className="focus-ring" aria-label={`Cancel ${pieceLabel} drop`} onClick={onCancel}>
        <X size={14} />
        <span>Cancel</span>
      </button>
    </div>
  );
}

type PromotionChoiceCardProps = {
  locale: string;
  onChoose: (promote: boolean) => void;
  pieceCode: string;
  pieceLabel: string;
  pieceOwner: Piece["owner"];
  pieceSkin: PieceSkinPreference;
  promotedPieceLabel: string;
  variantKey: string;
};

type TerrainKey = Exclude<NonNullable<GameState["board"][number][number]["terrain"]>, "land">;

type TerrainKeyLegendProps = {
  terrainKeys: TerrainKey[];
  locale?: string;
};

const terrainKeyOrder: TerrainKey[] = ["promotion-zone", "palace", "river", "den", "trap", "camp"];

export function PromotionChoiceCard({ locale, onChoose, pieceCode, pieceLabel, pieceOwner, pieceSkin, promotedPieceLabel, variantKey }: PromotionChoiceCardProps) {
  return (
    <div className="promotion-choice-card" role="dialog" aria-label={`${pieceLabel} promotion choice`}>
      <span>
        <strong>{pieceLabel}</strong>
        <small>Choose promotion</small>
      </span>
      <div>
        <button type="button" className="focus-ring" aria-label={`Promote to ${promotedPieceLabel}`} onClick={() => onChoose(true)}>
          <PieceIcon code={pieceCode} owner={pieceOwner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} promoted />
          <span>Promote to {promotedPieceLabel}</span>
        </button>
        <button type="button" className="focus-ring" aria-label={`Keep ${pieceLabel}`} onClick={() => onChoose(false)}>
          <PieceIcon code={pieceCode} owner={pieceOwner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} />
          <span>Keep {pieceLabel}</span>
        </button>
      </div>
    </div>
  );
}

export function TerrainKeyLegend({ terrainKeys, locale = "en" }: TerrainKeyLegendProps) {
  if (!terrainKeys.length) return null;
  const terrainLabels = getVocabulary(normalizeLocale(locale)).terrain;
  return (
    <div className="terrain-key" aria-label="Board terrain key">
      <span className="terrain-key-label">Zones</span>
      {terrainKeys.map((terrain) => (
        <span key={terrain} className="terrain-key-item" data-terrain={terrain}>
          <i aria-hidden="true" />
          <strong>{terrain === "promotion-zone" ? "Promo zone" : terrainLabels[terrain]}</strong>
        </span>
      ))}
    </div>
  );
}

function resolveSupportedPlayMode(variantKey: string, requestedMode: PlayMode): PlayMode {
  const entry = getGameCatalogEntry(variantKey);
  if (!entry) return requestedMode;
  if (getCatalogModeSupport(entry, requestedMode).enabled) return requestedMode;
  return getCatalogModeSupport(entry, "offline").enabled ? "offline" : "spectate";
}

function offlineModeSupport(mode: PlayMode): CatalogModeSupport {
  return { enabled: false, level: "guide-only", mode, reason: "Connect to the internet and return to the main app for this mode." };
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
  initialRoomId,
  initialSavedMatchId,
  localOnly = false,
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
  initialRoomId?: string;
  initialSavedMatchId?: string;
  localOnly?: boolean;
  locale?: string;
  title?: string;
}) {
  const [timeControl, setTimeControl] = useState<TimeControlKey>(initialTimeControl);
  const [state, setState] = useState(() => withTimeControl(initialState ?? createInitialState(variantKey), initialTimeControl));
  const [history, setHistory] = useState<GameState[]>([]);
  const [future, setFuture] = useState<GameState[]>([]);
  const [boardView, setBoardView] = useState<"2d" | "3d">("2d");
  const [pieceFinish, setPieceFinish] = useState<PieceFinish>("original");
  const collection3D = get3DCollection(variantKey);
  const [selected, setSelected] = useState<Square | null>(null);
  const [selectedHandCode, setSelectedHandCode] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [localPaused, setLocalPaused] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [playMode, setPlayMode] = useState<PlayMode>(() => resolveSupportedPlayMode(variantKey, initialPlayMode ?? (initialBotMode === "opponent" ? "bot" : "offline")));
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyKey>(() => getBotDifficultyLevel(initialBotDifficulty).key);
  const [botMode, setBotMode] = useState<BotMode>(initialBotMode);
  const [appearancePreset, setAppearancePreset] = useState<AppearancePresetPreference>("default");
  const [focusMode, setFocusMode] = useState(false);
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity>(defaultGuestIdentity);
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
  const quickMatchToken = useRef("");
  const cancellingSearchRef = useRef(false);
  const [cancellingSearch, setCancellingSearch] = useState(false);
  const [matchmaking, setMatchmaking] = useState<MatchmakingState>({ status: "idle" });
  const [ignoreInitialRoom, setIgnoreInitialRoom] = useState(false);
  const inviteRoomId = ignoreInitialRoom ? undefined : initialRoomId;
  const [roomCreation, setRoomCreation] = useState<RoomCreationState>(() => {
    const roomId = initialRoomId?.trim();
    return roomId ? { status: "ready", roomId } : { status: "idle" };
  });
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const friendHistoryRef = useRef("");
  const friendGameRef = useRef("");
  const friendId = (playMode === "room" || playMode === "spectate") && roomCreation.status === "ready" ? roomCreation.roomId : null;
  const syncFriendRoom = useCallback((room: FriendRoomView) => {
    if (room.state.variantKey !== variantKey) { setNotice("This invite belongs to another game. Open the original invite link."); return; }
    setState(current => current.id === room.state.id && (room.state.ply < current.ply || (current.status === "completed" && room.state.status !== "completed")) ? current : room.state);
    if (friendGameRef.current !== room.state.id) {
      friendGameRef.current = room.state.id;
      setReviewPly(null); setReviewPlaying(false); setFuture([]); setSelected(null); setSelectedHandCode(null); setNotice(null); setPendingPromotion(null);
    }
    const historyKey = room.state.id + ":" + room.state.ply + ":" + makrukCountVersion(room.state);
    if (friendHistoryRef.current !== historyKey) {
      friendHistoryRef.current = historyKey;
      let position = restoreJanggiOpening(createInitialState(variantKey, room.state.id), room.state);
      if (variantKey === "makruk" && !usesMakrukHonorCount(room.state)) delete position.variantState;
      const frames: GameState[] = [];
      for (const move of room.state.moves) { position = replayMakrukCountActions(position, room.state); frames.push(position); position = applyMove(position, move); }
      setHistory(frames);
    }
    setTimeControl(getTimeControl(room.time).key);
    if (room.seat) setHumanColor(room.seat);
  }, [variantKey]);
  const friend = useFriendRoom(friendId, gameStarted, playMode === "spectate", syncFriendRoom);
  const activeBotRequestRef = useRef<string | null>(null);
  const resolvedRandomSeatRef = useRef(false);
  const outcomeModalKeyRef = useRef<string | null>(null);
  const sidePanelRef = useRef<HTMLElement>(null);

  const localSnapshot = useMemo<LocalMatchSnapshot>(() => ({ state, history, future, settings: { playMode: playMode === "bot" ? "bot" : "offline", botMode, botDifficulty: getBotDifficultyLevel(botDifficulty).key, timeControl, humanColor, seatChoice, boardOrientation } }), [state, history, future, playMode, botMode, botDifficulty, timeControl, humanColor, seatChoice, boardOrientation]);
  const localGame = playMode === "offline" || playMode === "bot";
  const localSave = useLocalMatch(gameStarted && localGame && !localPaused ? localSnapshot : null);
  const { flush: flushLocalSave, adopt: adoptLocalSave } = localSave;
  const pauseLocalGame = useCallback(() => {
    flushLocalSave();
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    setThinking({ status: "idle", label: "" }); setLocalPaused(true);
  }, [flushLocalSave]);
  const restoreLocalGame = useCallback((saved: LocalMatchSnapshot, revision: number, paused = false) => {
    if (saved.state.variantKey !== variantKey) { setRestoreError("This save belongs to another game."); return; }
    const entry = getGameCatalogEntry(variantKey);
    if (!entry || !getCatalogModeSupport(entry, saved.settings.playMode).enabled) { setRestoreError("This saved mode is unavailable for this game."); return; }
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    adoptLocalSave(saved.state.id, revision);
    resolvedRandomSeatRef.current = true;
    outcomeModalKeyRef.current = saved.state.status === "completed" ? `${saved.state.id}:${saved.state.moves.length}:${saved.state.result ?? ""}:${saved.state.outcomeReason ?? ""}` : null;
    setState(saved.state); setHistory(saved.history); setFuture(saved.future);
    setPlayMode(saved.settings.playMode); setBotMode(saved.settings.botMode); setBotDifficulty(saved.settings.botDifficulty);
    setTimeControl(saved.settings.timeControl); setHumanColor(saved.settings.humanColor); setSeatChoice(saved.settings.seatChoice); setBoardOrientation(saved.settings.boardOrientation);
    setGameStarted(true); setLocalPaused(paused && saved.state.status === "active");
    setSelected(null); setSelectedHandCode(null); setPendingPromotion(null); setSuggestedMove(null); setLastBotResult(null);
    setThinking({ status: "idle", label: "" }); setReviewPly(null); setReviewPlaying(false); setShowOutcome(false); setPanelTab("status"); setNotice(null); setRestoreError("");
    setIgnoreInitialRoom(true); setRoomCreation({ status: "idle" }); setMatchmaking({ status: "idle" });
  }, [variantKey, adoptLocalSave]);
  useEffect(() => {
    if (!initialSavedMatchId || initialRoomId || (initialPlayMode && !["offline", "bot"].includes(initialPlayMode))) return;
    let cancelled = false;
    void readLocalMatch(initialSavedMatchId).then(saved => { if (!cancelled) restoreLocalGame(saved.snapshot, saved.revision, true); }).catch(cause => { if (!cancelled) setRestoreError(cause instanceof Error ? cause.message : "This save could not be opened."); });
    return () => { cancelled = true; };
  }, [initialSavedMatchId, initialRoomId, initialPlayMode, restoreLocalGame]);
  useEffect(() => {
    if (!gameStarted || !localGame || state.status !== "active") return;
    const hidden = () => { if (document.visibilityState === "hidden") pauseLocalGame(); };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", pauseLocalGame);
    return () => { document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", pauseLocalGame); };
  }, [gameStarted, localGame, state.status, pauseLocalGame]);
  useEffect(() => { if (localSave.status === "conflict") queueMicrotask(pauseLocalGame); }, [localSave.status, pauseLocalGame]);

  async function reloadLocalSave() {
    try { const saved = await readLocalMatch(state.id); restoreLocalGame(saved.snapshot, saved.revision, true); }
    catch (cause) { setRestoreError(cause instanceof Error ? cause.message : "This save could not be opened."); }
  }
  function keepLocalCopy() {
    const id = crypto.randomUUID();
    const copy = { ...localSnapshot, state: { ...state, id }, history: history.map(frame => ({ ...frame, id })), future: future.map(frame => ({ ...frame, id })) };
    localSave.adopt(id, 0); setState(copy.state); setHistory(copy.history); setFuture(copy.future); localSave.enqueue(copy);
  }

  useEffect(() => {
    queueMicrotask(() => {
      setAppearancePreset(initialAppearancePreset(variantKey));
      try {
        setBoardView(get3DCollection(variantKey) && localStorage.getItem(`allchess-board-view:${variantKey}`) === "3d" ? "3d" : "2d");
        const finish = localStorage.getItem(`allchess-piece-finish:${variantKey}`);
        setPieceFinish(isPieceFinish(finish) ? finish : "original");
      } catch { /* Keep the accessible 2D default. */ }
    });
  }, [variantKey]);

  useEffect(() => {
    if (!focusMode) return;
    function exitFocus(event: KeyboardEvent) { if (event.key === "Escape") setFocusMode(false); }
    document.addEventListener("keydown", exitFocus);
    return () => document.removeEventListener("keydown", exitFocus);
  }, [focusMode]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = window.localStorage.getItem(guestIdentityStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<GuestIdentity>;
          if (parsed.bottom && parsed.top) {
            setGuestIdentity({ bottom: parsed.bottom, top: parsed.top });
            return;
          }
        }
        const nextIdentity = initialGuestIdentity();
        setGuestIdentity(nextIdentity);
        window.localStorage.setItem(guestIdentityStorageKey, JSON.stringify(nextIdentity));
      } catch {
        // Guest labels are cosmetic; storage can be unavailable in restricted browsers.
      }
    });
  }, []);

  const timeline = useMemo(() => (history.length ? [...history, state] : [state]), [history, state]);
  const reviewMoves = useMemo(() => analyzeMoveList(state.moves), [state.moves]);
  const reviewSummary = useMemo(() => summarizeReview(reviewMoves), [reviewMoves]);
  const displayPly = reviewPly ?? timeline.length - 1;
  const displayState = timeline[Math.min(displayPly, timeline.length - 1)] ?? state;
  const activeReviewMove = displayPly > 0 ? reviewMoves[displayPly - 1] : null;
  const isReviewing = reviewPly !== null;
  const terrainKeys = useMemo(() => {
    const present = new Set<TerrainKey>();
    for (const row of displayState.board) {
      for (const cell of row) {
        if (cell.terrain && cell.terrain !== "land") present.add(cell.terrain);
      }
    }
    return terrainKeyOrder.filter((terrain) => present.has(terrain));
  }, [displayState.board]);
  const selectedHandPiece = useMemo(() => (selectedHandCode ? createHandDropPiece(state.turn, selectedHandCode) : null), [selectedHandCode, state.turn]);
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : selectedHandPiece ? getLegalMoves(state, { drop: selectedHandPiece }) : []), [selected, selectedHandPiece, state]);
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => serializeSquare(move.to))), [legalMoves]);
  const selectedHandLabel = selectedHandCode ? getPieceDisplayName(selectedHandCode, variantKey, locale) : null;
  const botColor = state.clocks.find((clock) => clock.color !== humanColor)?.color ?? state.clocks[1]?.color ?? "black";
  const rows = displayState.board.length;
  const cols = displayState.board[0]?.length ?? 8;
  const files = useMemo(() => Array.from({ length: cols }, (_, index) => String.fromCharCode(97 + index)), [cols]);
  const reviewMoveRows = useMemo(() => buildReviewMoveRows({ files, locale, moves: reviewMoves, rawMoves: state.moves, rows, timeline, variantKey: displayState.variantKey }), [displayState.variantKey, files, locale, reviewMoves, rows, state.moves, timeline]);
  const botLevel = getBotDifficultyLevel(botDifficulty);
  const appearanceOptions = useMemo(() => getAppearancePresetOptions(variantKey), [variantKey]);
  const appearance = useMemo(() => resolveAppearancePreset(variantKey, appearancePreset), [appearancePreset, variantKey]);
  const boardTheme = appearance.boardTheme;
  const pieceSkin = appearance.pieceSkin;
  const supportsDrops = useMemo(() => getVariant(variantKey).supportsDrops, [variantKey]);
  const botStrength = useMemo(() => getVariantBotStrengthProfile(variantKey, botDifficulty), [botDifficulty, variantKey]);
  const botCalibrationLabel = botStrength.calibrationStatus.replace(/-/g, " ");
  const botResponseBudget = Math.min(botLevel.moveTimeMs, MAX_BOT_REPLY_MS - 180);
  const outcome = useMemo(() => describeGameOutcome(state, humanColor), [humanColor, state]);
  const outcomeKey = state.status === "completed" ? `${state.id}:${state.moves.length}:${state.result ?? ""}:${state.outcomeReason ?? ""}` : null;
  const firstColor = (state.clocks[0]?.color ?? "white") as Piece["owner"];
  const secondColor = (state.clocks[1]?.color ?? "black") as Piece["owner"];
  const catalogEntry = useMemo(() => getGameCatalogEntry(variantKey), [variantKey]);
  const modeSupport = useMemo(
    () => ({
      online: localOnly ? offlineModeSupport("online") : catalogEntry ? getCatalogModeSupport(catalogEntry, "online") : unavailableModeSupport("online"),
      bot: catalogEntry ? getCatalogModeSupport(catalogEntry, "bot") : unavailableModeSupport("bot"),
      offline: catalogEntry ? getCatalogModeSupport(catalogEntry, "offline") : unavailableModeSupport("offline"),
      room: localOnly ? offlineModeSupport("room") : catalogEntry ? getCatalogModeSupport(catalogEntry, "room") : unavailableModeSupport("room"),
      spectate: localOnly ? offlineModeSupport("spectate") : catalogEntry ? getCatalogModeSupport(catalogEntry, "spectate") : unavailableModeSupport("spectate")
    }),
    [catalogEntry, localOnly]
  );
  const isThinking = thinking.status === "thinking";
  const isOnlineMode = playMode === "online" || playMode === "room";
  const isBotMode = playMode === "bot";
  const isSpectating = playMode === "spectate";
  const isMatchedOnlineGame = (playMode === "room" && friend.room?.playerCount === 2) || (playMode === "online" && matchmaking.status === "matched");
  const isSearchingOnline = gameStarted && isOnlineMode && state.status !== "completed" && !isMatchedOnlineGame;
  const isWatchingMode = gameStarted && isSpectating && state.status !== "completed";
  const canUseAssist = gameStarted && state.status === "active" && !isThinking && !localPaused && !isReviewing && !isOnlineMode && !isSpectating;
  const canUseBots = gameStarted && state.status === "active" && isBotMode && !isThinking && !localPaused && !isReviewing && !isOnlineMode && !isSpectating;
  const canUndo = history.length > 0 && !isThinking && !localPaused && !isReviewing && !isOnlineMode && !isSpectating;
  const canRedo = future.length > 0 && !isThinking && !localPaused && !isReviewing && !isOnlineMode && !isSpectating;
  const canEndGame = gameStarted && state.status === "active" && !localPaused && !isReviewing && !isSpectating && !isSearchingOnline;
  const visualOrientation = boardOrientation === "auto" ? (humanColor === secondColor ? "second" : "first") : boardOrientation;
  const isBoardFlipped = visualOrientation === "second";
  const orientedRows = useMemo(() => {
    const rowsToRender = displayState.board.map((row) => [...row]);
    return isBoardFlipped ? rowsToRender.reverse().map((row) => row.reverse()) : rowsToRender;
  }, [displayState.board, isBoardFlipped]);
  const modeDetails = playModeOptions.find((option) => option.key === (friend.room?.matched ? "online" : playMode)) ?? playModeOptions[2];
  const chatRoomId =
    inviteRoomId?.trim() ||
    (roomCreation.status === "ready" ? roomCreation.roomId : "") ||
    (matchmaking.status === "matched" ? matchmaking.roomId : "") ||
    `${displayState.variantKey}-local`;
  const onlineTicketLabel = matchmaking.status === "queued" ? `Ticket ${matchmaking.ticketId.slice(0, 8)}` : null;
  const statusHeading = playMode === "room" && gameStarted
    ? friend.room?.matched ? "Casual match" : "Invite room ready"
    : isSearchingOnline
    ? "Searching for opponent"
    : isWatchingMode
      ? "Watching rooms"
      : "Current position";
  const botSearchDetail = lastBotResult
    ? `Bot: ${lastBotResult.knowledgeSource ?? lastBotResult.engine} ${lastBotResult.depthReached}/${lastBotResult.nodesSearched}.`
    : isBotMode
      ? `Bot budget: ${botResponseBudget}ms.`
      : "";
  const topPlayerColor = isBoardFlipped ? firstColor : secondColor;
  const bottomPlayerColor = isBoardFlipped ? secondColor : firstColor;
  const capturedBy = useCallback(
    (color: string) => state.captured.filter((piece) => piece.owner !== color),
    [state.captured]
  );

  function playerCard(color: Piece["owner"], placement: "top" | "bottom") {
    const handCounts = displayState.hands?.[color] ?? {};
    const canUseHand = canHumanMove(color) && Object.values(handCounts).some((count) => count > 0);
    const isBotSeat = color === botColor && botMode !== "human";
    const isHumanSeat = color === humanColor;
    const guestName = isHumanSeat ? guestIdentity.bottom : guestIdentity.top;
    return (
      <BoardPlayerCard
        botLevelLabel={botLevel.label}
        botModeActive={isBotSeat}
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
        playerAvatarLabel={isBotSeat ? "AI" : isHumanSeat ? "YOU" : "G2"}
        playerLabel={isBotSeat ? undefined : guestName}
        placement={placement}
        selectedHandCode={!isReviewing && color === state.turn ? selectedHandCode : null}
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
      !localPaused &&
      !friend.busy &&
      (playMode !== "room" || friend.connection === "connected") &&
      (playMode !== "room" || (friend.room?.seat === color && friend.room.state.variantKey === variantKey)) &&
      (!isOnlineMode || isMatchedOnlineGame) &&
      !isSpectating &&
      color === state.turn &&
      botMode !== "both" &&
      !(botMode === "opponent" && state.turn !== humanColor)
    );
  }

  function changeAppearancePreset(nextPreset: AppearancePresetPreference) {
    const validPreset = isAppearancePresetPreference(variantKey, nextPreset) ? nextPreset : "default";
    setAppearancePreset(validPreset);
    try { window.localStorage.setItem(`${appearanceStoragePrefix}${variantKey}`, validPreset); } catch { /* Keep the selected look for this session. */ }
  }

  function changeBoardView(view: "2d" | "3d") {
    setBoardView(view);
    try { localStorage.setItem(`allchess-board-view:${variantKey}`, view); } catch { /* Keep the view for this session. */ }
  }

  function changePieceFinish(finish: PieceFinish) {
    setPieceFinish(finish);
    try { localStorage.setItem(`allchess-piece-finish:${variantKey}`, finish); } catch { /* Session fallback. */ }
  }

  function commitPlayerMove(move: Move) {
    if (playMode === "room") {
      void friend.send({ gameId: state.id, action: "move", move, version: state.ply, countVersion: makrukCountVersion(state) });
      setSelected(null); setSelectedHandCode(null); setPendingPromotion(null); return;
    }
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

  function changeOukCount(action: OukCountAction) {
    if (!gameStarted || localPaused || isReviewing || isOnlineMode || isSpectating || botMode === "both") return;
    const count = readOukCount(state);
    const actor = botMode === "opponent" ? humanColor : action === "stop" && count ? count.side : action === "claim-draw" && count ? count.side === "white" ? "black" : "white" : state.turn;
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    setThinking({ status: "idle", label: "" });
    setState(current => { try { return applyOukCountAction(current, actor, action); } catch { return current; } });
    setFuture([]);
    setSuggestedMove(null);
    setNotice(action === "stop" ? "Counting stopped. A new board count starts from 1." : action === "claim-draw" ? "Draw accepted under the counting rule." : "Counting begins on your next move.");
  }

  function changeMakrukCount(action: MakrukCountAction) {
    if (!gameStarted || localPaused || isReviewing || isSpectating || botMode === "both") return;
    if (playMode === "room") {
      void friend.send({ gameId: state.id, action: "count", countAction: action, version: state.ply, countVersion: makrukCountVersion(state) }); return;
    }
    if (isOnlineMode) return;
    const count = readMakrukHonorCount(state);
    const actor = botMode === "opponent" ? humanColor : action === "stop" && count ? count.side : action === "claim-draw" && count ? count.side === "white" ? "black" : "white" : state.turn;
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null; setThinking({ status: "idle", label: "" });
    setState(current => { try { return applyMakrukCountAction(current, actor, action); } catch { return current; } });
    setFuture([]); setSuggestedMove(null);
    setNotice(action === "stop" ? "Counting stopped. A new board count starts from 1." : action === "claim-draw" ? "Draw accepted under the counting rule." : "Counting begins on your next move.");
  }

  function loadMakrukEndgame(key: MakrukEndgameKey) {
    reset(); setPlayMode("offline"); setBotMode("human"); setTimeControl("freestyle");
    setSeatChoice("first"); setHumanColor("white"); setState(createMakrukEndgame(key));
    setNotice(`Practice: ${makrukEndgames.find(item => item.key === key)?.label}. White moves first.`);
  }

  function loadOukEndgame(key: OukEndgameKey) {
    reset();
    setPlayMode("offline"); setBotMode("human"); setTimeControl("freestyle");
    setSeatChoice("first"); setHumanColor("white");
    setState(createOukEndgame(key));
    setNotice(`Practice: ${oukEndgames.find(item => item.key === key)?.label}. White moves first.`);
  }

  function commitMoveChoice(candidates: Move[], piece?: Piece | null) {
    const promoteMove = candidates.find((candidate) => candidate.promotion === true);
    const keepMove = candidates.find((candidate) => candidate.promotion !== true);
    if (promoteMove && keepMove && piece) {
      setPendingPromotion({
        keepMove,
        promoteMove,
        pieceCode: piece.code,
        pieceLabel: getPieceDisplayName(piece.code, variantKey, locale, piece.promoted),
        pieceOwner: piece.owner,
        promotedPieceLabel: getPieceDisplayName(piece.code, variantKey, locale, true)
      });
      setNotice(null);
      return true;
    }
    commitPlayerMove(promoteMove ?? keepMove ?? candidates[0]);
    return true;
  }

  function chooseHandPiece(color: Piece["owner"], code: string) {
    if (!canHumanMove(color) || (state.hands?.[color]?.[code] ?? 0) <= 0) return;
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
    if (isOnlineMode && !isMatchedOnlineGame) {
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
    if (!canHumanMove(state.turn)) return;
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
      const prepared = prepareMakrukBotTurn(prepareOukBotTurn(snapshot));
      if (prepared !== snapshot) setState(current => current.id === snapshot.id && current.ply === snapshot.ply ? { ...current, variantState: prepared.variantState } : current);
      setThinking({ status: "thinking", label: source === "auto" ? "Bot is replying..." : "Bot is thinking..." });
      setNotice(null);

      const result = await requestRuntimeBotMove(prepared, botDifficulty, {
        requestId,
        delayMs: source === "auto" ? 80 : 0,
        maxSearchTimeMs: Math.min(botLevel.moveTimeMs, MAX_BOT_REPLY_MS - 180)
      });
      finishBotRequest(prepared, result, source);
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
    if (playMode === "room") { void friend.send({ gameId: state.id, action: "draw" }); return; }
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
    if (playMode === "room") { void friend.send({ gameId: state.id, action: "resign" }); return; }
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
    if (playMode === "room") { setIgnoreInitialRoom(true); const url = new URL(window.location.href); url.searchParams.delete("room"); window.history.replaceState(null, "", url); }
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    const nextState = withTimeControl(copyJanggiFormations(createInitialState(variantKey), state), timeControl);
    resolvedRandomSeatRef.current = false;
    setHistory([]);
    setFuture([]);
    setState(nextState);
    setHumanColor(pickHumanColor(nextState, seatChoice));
    setGameStarted(false);
    setLocalPaused(false);
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
    setMatchmaking({ status: "idle" });
    setRoomCreation({ status: "idle" });
  }

  function leaveUnplayedMatch() {
    if (!friend.room?.matched || !friend.room.arrival || !friend.room.seat) return;
    void friend.send({ action: "leave-before-start", gameId: state.id });
  }

  function findAnotherOpponent(search: boolean) {
    if (!friend.room?.seat || !friend.room.arrival || friend.room.arrival.status === "waiting") return;
    reset();
    const url = new URL(window.location.href); url.searchParams.set("mode", "online"); url.searchParams.delete("room"); window.history.replaceState(null, "", url);
    setPlayMode("online"); setBotMode("human"); setSeatChoice("random"); setBoardOrientation("auto");
    if (search) {
      quickMatchToken.current = crypto.randomUUID() + crypto.randomUUID();
      setState(current => ({ ...current, status: "waiting" })); setGameStarted(true); setPanelTab("status");
      setNotice("Finding another opponent with the same game and clock…");
    }
  }

  function changeTimeControl(nextControl: TimeControlKey) {
    const requestId = activeBotRequestRef.current;
    if (requestId) cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    const exercise = oukEndgames.find(item => item.key === state.variantState?.oukExercise);
    const thaiExercise = makrukEndgames.find(item => item.key === state.variantState?.makrukExercise);
    const nextState = withTimeControl(exercise ? createOukEndgame(exercise.key) : thaiExercise ? createMakrukEndgame(thaiExercise.key) : copyJanggiFormations(createInitialState(variantKey), state), nextControl);
    resolvedRandomSeatRef.current = false;
    setTimeControl(nextControl);
    setHistory([]);
    setFuture([]);
    setState(nextState);
    setHumanColor(pickHumanColor(nextState, seatChoice));
    setGameStarted(false);
    setLocalPaused(false);
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
    setRoomCreation({ status: "idle" });
  }

  function changeJanggiFormation(side: JanggiSide, formation: JanggiFormation) {
    if (gameStarted || !localGame) return;
    setState(current => withJanggiFormation(current, side, formation));
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
    quickMatchToken.current = crypto.randomUUID() + crypto.randomUUID();
    setGameStarted(true);
    setLocalPaused(false);
    setRestoreError("");
    setState((current) => (isOnlineMode || isSpectating ? { ...current, status: "waiting" } : { ...current, status: "active" }));
    setMatchmaking({ status: "idle" });
    setRoomCreation(
      (playMode === "room" || (playMode === "spectate" && inviteRoomId))
        ? inviteRoomId?.trim()
          ? { status: "ready", roomId: inviteRoomId.trim() }
          : { status: "creating" }
        : { status: "idle" }
    );
    setPanelTab("status");
    setNotice(
      playMode === "online"
        ? "Finding an opponent for a casual game. Sides are assigned when paired."
        : playMode === "room"
          ? "Invite room ready. Share the invite link, spectator link, or room code."
          : isSpectating
            ? "Spectate mode is read-only. Watch rooms without moving pieces."
            : null
    );
  }

  const enterMatchedRoom = useCallback((roomId: string, token: string) => {
    saveFriendToken(roomId, token);
    const url = new URL(window.location.href); url.searchParams.set("room", roomId); url.searchParams.set("mode", "room"); window.history.replaceState(null, "", url);
    setMatchmaking({ status: "matched", roomId }); setRoomCreation({ status: "ready", roomId }); setPlayMode("room");
    setNotice("Opponent found. Connecting to your game…");
  }, []);

  async function cancelOnlineSearch() {
    if (cancellingSearchRef.current) return;
    cancellingSearchRef.current = true; setCancellingSearch(true);
    const token = quickMatchToken.current;
    try {
      const response = await fetch("/api/matchmaking/leave", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, variantKey, timeControlKey: timeControl }), signal: AbortSignal.timeout(8000) });
      const data = await response.json() as { left?: boolean; match?: { roomId: string }; error?: string };
      if (token !== quickMatchToken.current) return;
      if (!response.ok) throw new Error(data.error);
      if (data.match) { enterMatchedRoom(data.match.roomId, token); return; }
      if (!data.left) throw new Error("Cancellation not confirmed.");
      setMatchmaking({ status: "idle" }); setGameStarted(false); setState(current => ({ ...current, status: "waiting" })); setPanelTab("setup");
      setNotice("Search cancelled. Start again when ready.");
    } catch { if (token === quickMatchToken.current) setNotice("Cancellation not confirmed. Reconnect and try again."); }
    finally { cancellingSearchRef.current = false; setCancellingSearch(false); }
  }

  function selectPlayMode(nextMode: PlayMode) {
    if (!modeSupport[nextMode].enabled) {
      setNotice(modeSupport[nextMode].reason);
      return;
    }
    setPlayMode(nextMode);
    setMatchmaking({ status: "idle" });
    if (nextMode !== "room") setRoomCreation({ status: "idle" });
    setSelected(null);
    setSelectedHandCode(null);
    if (nextMode !== "bot") {
      setBotMode("human");
      setLastBotResult(null);
    }
    if (nextMode === "online") {
      setNotice("Quick Match finds an opponent for a casual game with your selected clock.");
    } else if (nextMode === "room") {
      setNotice("Room setup selected. Bot controls are disabled while waiting for a player.");
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
    setNotice("Back to current board.");
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
    if (!gameStarted || localPaused || isReviewing || state.status !== "active" || thinking.status === "thinking") return;
    const shouldMove = botMode === "both" || (botMode === "opponent" && state.turn === botColor);
    if (!shouldMove) return;
    const snapshot = state;
    const timer = window.setTimeout(() => {
      void playBotMove("auto", snapshot);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [botColor, botMode, gameStarted, localPaused, isReviewing, playBotMove, state, thinking.status]);

  useEffect(() => {
    if (!gameStarted || playMode !== "room" || roomCreation.status !== "creating") return;
    const controller = new AbortController();
    let cancelled = false;

    async function createFriendRoom() {
      const seatToken = crypto.randomUUID() + crypto.randomUUID();
      try {
        const response = await fetch("/api/friends/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "create", variantKey, time: timeControl, side: seatChoice, token: seatToken }),
          signal: controller.signal
        });
        const data = (await response.json().catch(() => ({}))) as {
          room?: FriendRoomView;
          error?: string;
        };
        if (cancelled) return;
        const roomId = data.room?.roomId;
        if (!response.ok || !roomId) {
          const message = data.error ?? "Could not create a friend room. Please retry.";
          setRoomCreation({ status: "failed", message });
          setNotice(message);
          return;
        }
        saveFriendToken(roomId, seatToken);
        const url = new URL(window.location.href); url.searchParams.set("room", roomId); url.searchParams.set("mode", "room"); window.history.replaceState(null, "", url);
        setRoomCreation({ status: "ready", roomId });
        setNotice(`Invite room ${roomId} is ready. Share can copy the invite or spectator link.`);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Could not create a room code.";
        setRoomCreation({ status: "failed", message });
        setNotice(message);
      }
    }

    void createFriendRoom();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gameStarted, playMode, roomCreation.status, variantKey, timeControl, seatChoice]);

  useEffect(() => {
    if (!gameStarted || playMode !== "online") return;
    const controller = new AbortController();
    let cancelled = false, timer: ReturnType<typeof setTimeout>, failures = 0;
    const token = quickMatchToken.current;
    async function poll() {
      try {
        if (!navigator.onLine) throw new Error("You’re offline. Reconnecting to your search…");
        const response = await fetch("/api/matchmaking/join", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, variantKey, timeControlKey: timeControl, rated: false }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
        });
        const data = await response.json() as { ticket?: { ticketId: string }; match?: { roomId: string }; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          if ([400, 403, 410].includes(response.status)) { setMatchmaking({ status: "failed", message: data.error ?? "Start a new search." }); return; }
          throw new Error(data.error ?? "Reconnecting to your search…");
        }
        failures = 0;
        if (data.match) { enterMatchedRoom(data.match.roomId, token); return; }
        if (data.ticket) { setMatchmaking({ status: "queued", ticketId: data.ticket.ticketId }); setNotice("Looking for an opponent with the same game and clock. You can cancel anytime."); }
      } catch (error) {
        if (cancelled) return;
        failures++; setNotice(error instanceof Error ? error.message : "Reconnecting to your search…");
      }
      if (!cancelled) timer = setTimeout(poll, Math.min(8000, 1500 * 2 ** Math.min(failures, 3)));
    }
    void poll();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [gameStarted, playMode, timeControl, variantKey, enterMatchedRoom]);

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
      if (!gameStarted || localPaused || isSearchingOnline || isWatchingMode || playMode === "room") return;
      setState((current) => tickGameClock(current, elapsed));
    }, 250);
    return () => window.clearInterval(timer);
  }, [gameStarted, localPaused, isSearchingOnline, isWatchingMode, playMode]);

  return (
    <div className="game-board-layout game-studio grid gap-4" data-focus={focusMode && gameStarted ? "true" : undefined} style={{ "--board-ratio": cols / rows } as CSSProperties}>
      <div className="board-column grid gap-3">
        {restoreError ? <p className="local-save-error" role="alert">{restoreError}</p> : null}
        {gameStarted && localGame ? <div className="local-save-bar" role="status" aria-label="Local save status">
          <span>{localSave.status === "error" || localSave.status === "conflict" ? localSave.error : localPaused ? "Paused · your clock waits for you" : (localSave.status === "saving" || localSave.status === "idle") ? "Saving on this device…" : "Saved on this device"}</span>
          {localSave.status === "conflict" ? <><button type="button" className="focus-ring" onClick={() => void reloadLocalSave()}>Open latest save</button><button type="button" className="focus-ring" onClick={keepLocalCopy}>Keep this board as a copy</button></> : <>
            {localSave.status === "error" ? <button type="button" className="focus-ring" onClick={() => localSave.retry(localSnapshot)}>Retry save</button> : null}
            {state.status === "active" ? <button type="button" className="focus-ring" onClick={() => localPaused ? setLocalPaused(false) : pauseLocalGame()}>{localPaused ? "Resume game" : "Pause"}</button> : null}
          </>}
          <button type="button" className="focus-ring" onClick={() => { try { downloadLocalMatch(localSnapshot); setRestoreError(""); } catch (cause) { setRestoreError(cause instanceof Error ? cause.message : "This game could not be exported."); } }}>Export game</button>
        </div> : null}
        <BoardToolbar is3D={boardView === "3d" && !!collection3D} variantKey={variantKey} appearancePreset={appearancePreset} onAppearanceChange={changeAppearancePreset} onFlip={flipBoard} onGuide={rulesSummary ? () => setShowRules(true) : undefined} focusMode={focusMode && gameStarted} onFocusChange={() => setFocusMode((current) => !current)} canFocus={gameStarted} />
        {collection3D ? <div className="board-view-buttons" role="group" aria-label="Board view"><button type="button" className="focus-ring" aria-pressed={boardView === "2d"} onClick={() => changeBoardView("2d")}>2D board</button><button type="button" className="focus-ring" aria-pressed={boardView === "3d"} onClick={() => changeBoardView("3d")}>{collection3D === "xiangqi" ? "3D discs" : collection3D === "shogi" || collection3D === "janggi" ? "3D tiles" : "3D carved"}</button>{boardView === "3d" ? <div role="group" aria-label="Piece material" className="board-finish-buttons">{(["original", "porcelain", "slate"] as const).map(finish => <button key={finish} type="button" className="focus-ring" aria-pressed={pieceFinish === finish} onClick={() => changePieceFinish(finish)}>{finish === "original" ? collection3D === "shogi" || collection3D === "xiangqi" ? "Boxwood" : collection3D === "janggi" ? "Ivory" : collection3D === "makruk" ? "Thai lacquer" : "Original" : finish === "porcelain" ? "Porcelain" : "Slate"}</button>)}</div> : null}</div> : null}
        {friendId && gameStarted ? friend.room?.arrival ? <MatchArrivalPanel room={friend.room} connected={friend.connection === "connected"} busy={friend.busy} error={friend.error} onCancel={leaveUnplayedMatch} onFindAnother={() => findAnotherOpponent(true)} onSetup={() => findAnotherOpponent(false)} onReconnect={friend.reconnect} /> : <div className="room-live-status" role="status">
          <span>{friend.connection !== "connected"
            ? friend.connection === "offline" ? state.status === "waiting" || timeControl === "freestyle" ? "You’re offline · waiting for a connection" : "You’re offline · the room clock continues" : friend.connection === "connecting" ? "Connecting to your room…" : friend.connection === "unavailable" ? friend.error : "Reconnecting · checking the latest board…"
            : friend.error ?? (state.status === "completed" ? "Game finished" : pendingJanggiSide(friend.room?.janggiSetup) ? "Opening setup · clocks are stopped" : friend.room?.matched && state.status === "waiting" ? "Opponent found · waiting for both players to connect" : friend.room?.playerCount === 2 ? (playMode === "spectate" ? "Watching live" : friend.room.seat === state.turn ? "Your turn" : friend.room?.matched ? "Opponent’s turn" : "Friend’s turn") : "Waiting for your friend · share the invite link")}
            {friend.connection === "connected" && playMode === "room" && state.status === "active" && friend.room?.playerCount === 2 && !friend.room.friendConnected ? friend.room.matched ? " · Opponent disconnected" : " · Friend disconnected" : ""}
          </span>
          {friend.connection === "reconnecting" || friend.connection === "unavailable" ? <button type="button" className="focus-ring action-secondary" onClick={friend.reconnect}>Reconnect now</button> : null}
          {friend.room?.drawOffer && state.status === "active" ? <button type="button" className="focus-ring action-secondary" disabled={friend.busy || friend.connection !== "connected" || playMode === "spectate" || friend.room.drawOffer === friend.room.seat} onClick={() => void friend.send({ gameId: state.id, action: "draw" })}>{friend.room.drawOffer === friend.room.seat ? "Draw offered" : "Accept draw"}</button> : null}
          {state.status === "completed" && playMode === "room" ? <button type="button" className="focus-ring action-secondary" disabled={friend.busy || friend.connection !== "connected"} onClick={() => void friend.send({ gameId: state.id, action: friend.room?.rematchOffer === friend.room?.seat ? "cancel-rematch" : "rematch" })}>{friend.room?.rematchOffer ? friend.room.rematchOffer === friend.room.seat ? "Cancel rematch offer" : "Accept rematch" : "Rematch"}</button> : null}
        </div> : null}
        {friendId && gameStarted && pendingJanggiSide(friend.room?.janggiSetup) && (!friend.room?.arrival || friend.room.arrival.status === "waiting") ? <JanggiRoomSetup key={`${state.id}:${pendingJanggiSide(friend.room?.janggiSetup)}`} side={pendingJanggiSide(friend.room?.janggiSetup)!} canChoose={playMode === "room" && friend.room?.seat === pendingJanggiSide(friend.room?.janggiSetup)} disabled={friend.busy || friend.connection !== "connected"} onConfirm={formation => void friend.send({ action: "formation", gameId: state.id, formation })} /> : null}
        {playerCard(topPlayerColor, "top")}
        {variantKey === "makruk" && gameStarted ? <MakrukCountingPanel state={displayState} actor={playMode === "room" ? friend.room?.seat ?? state.turn : botMode === "opponent" ? humanColor : state.turn} localTwoPlayer={!isOnlineMode && !isSpectating && botMode === "human"} disabled={localPaused || isReviewing || isSpectating || botMode === "both" || (isOnlineMode && playMode !== "room") || (playMode === "room" && (friend.busy || friend.connection !== "connected" || !friend.room?.seat))} onAction={changeMakrukCount} /> : null}
        {variantKey === "ouk-chaktrang" && gameStarted ? <OukCountingPanel state={displayState} actor={botMode === "opponent" ? humanColor : state.turn} localTwoPlayer={!isOnlineMode && !isSpectating && botMode === "human"} disabled={localPaused || isReviewing || isOnlineMode || isSpectating || botMode === "both"} onAction={changeOukCount} /> : null}
        <div className="board-shell" data-view={boardView === "3d" && collection3D ? "3d" : "2d"} data-variant={displayState.variantKey} data-board-theme={boardTheme} data-variant-size={`${cols}x${rows}`} style={{ "--board-cols": cols, "--board-rows": rows } as CSSProperties}>
          <div className="board-stage">
            {boardView === "3d" && collection3D ? <Board3D key={variantKey} collection={collection3D} variantKey={variantKey} orientedRows={orientedRows} legalTargets={legalTargets} selected={selected} onChoose={choose} boardTheme={boardTheme} lastMove={displayState.moves.at(-1)} finish={pieceFinish} hands={displayState.hands} selectedHand={!isReviewing && selectedHandCode ? { owner: state.turn, code: selectedHandCode } : null} onChooseHand={chooseHandPiece} onFallback={() => changeBoardView("2d")} /> : <BoardGrid cols={cols} files={files} legalTargets={legalTargets} legalTargetMode={selectedHandPiece ? "drop" : "move"} locale={locale} onChoose={choose} onDragMove={dragBoardMove} onDropHandPiece={dropHandPiece} orientedRows={orientedRows} pieceSkin={pieceSkin} rows={rows} selected={selected} suggestedMove={suggestedMove} lastMove={displayState.moves.at(-1)} variantKey={displayState.variantKey} />}
            {selectedHandCode && selectedHandLabel ? <DropSelectionHint legalTargetCount={legalTargets.size} locale={locale} onCancel={cancelHandDrop} pieceCode={selectedHandCode} pieceLabel={selectedHandLabel} pieceOwner={state.turn} pieceSkin={pieceSkin} variantKey={displayState.variantKey} /> : null}
            {pendingPromotion ? (
              <PromotionChoiceCard locale={locale} onChoose={choosePromotion} pieceCode={pendingPromotion.pieceCode} pieceLabel={pendingPromotion.pieceLabel} pieceOwner={pendingPromotion.pieceOwner} pieceSkin={pieceSkin} promotedPieceLabel={pendingPromotion.promotedPieceLabel} variantKey={displayState.variantKey} />
            ) : null}
            {!gameStarted ? (
              <div className="pregame-board-overlay" role="status">
                <button type="button" className="focus-ring" aria-label="Open game setup" onClick={() => { setPanelTab("setup"); sidePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><strong>Choose setup first</strong></button>
              </div>
            ) : null}
            {outcome && !isReviewing ? (
              <MatchResultOverlay
                outcome={outcome}
                showModal={showOutcome}
                onClose={() => setShowOutcome(false)}
                onPlayAgain={playMode === "room" ? () => { void friend.send({ gameId: state.id, action: "rematch" }); } : reset}
                playAgainLabel={playMode === "room" ? friend.room?.rematchOffer ? friend.room.rematchOffer === friend.room.seat ? friend.room.matched ? "Waiting for opponent…" : "Waiting for friend…" : "Accept rematch · swap sides" : "Rematch · swap sides" : undefined}
                playAgainDisabled={playMode === "room" && (friend.busy || friend.connection !== "connected" || friend.room?.rematchOffer === friend.room?.seat)}
                onCancelRematch={playMode === "room" && friend.room?.rematchOffer && friend.room.rematchOffer === friend.room.seat && !friend.busy && friend.connection === "connected" ? () => { void friend.send({ gameId: state.id, action: "cancel-rematch" }); } : undefined}
                onReview={() => {
                  setShowOutcome(false);
                  startReview();
                }}
              />
            ) : null}
          </div>
        </div>
        {boardView === "3d" && collection3D ? null : <TerrainKeyLegend terrainKeys={terrainKeys} locale={locale} />}
        {playerCard(bottomPlayerColor, "bottom")}
      </div>

      <aside ref={sidePanelRef} className="game-side-panel play-panel grid content-start gap-4 p-4">
        <PlayMatchHeader
          localOnly={localOnly}
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
          roomId={chatRoomId}
          showGuide={Boolean(rulesSummary)}
          timeControl={timeControl}
          title={title}
        />
        {!gameStarted && localGame && !localOnly ? <SavedMatches locale={locale} variantKey={variantKey} onResume={restoreLocalGame} /> : null}
        <PlaySectionTabs activeTab={panelTab} onChange={setPanelTab} />
        <div className="play-tab-panel">
          {panelTab === "setup" ? (
            gameStarted ? (
              <PlayActiveSetupCard modeLabel={modeDetails.label} onReset={reset} onShowStatus={() => setPanelTab("status")} timeControlLabel={getTimeControl(timeControl).label} />
            ) : (
              <><PlayPregameSetupCard
                gameSetup={variantKey === "janggi" && localGame ? <JanggiLocalSetup values={readJanggiFormations(state)} onChange={changeJanggiFormation} /> : undefined}
                joiningRoom={Boolean(inviteRoomId)}
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
              {variantKey === "ouk-chaktrang" && (playMode === "offline" || playMode === "bot") ? <OukEndgamePicker onChoose={loadOukEndgame} /> : null}
              {variantKey === "makruk" && (playMode === "offline" || playMode === "bot") ? <MakrukEndgamePicker onChoose={loadMakrukEndgame} /> : null}</>
            )
          ) : null}
          {panelTab === "status" ? (
            <div className="grid gap-3">
              <PlayControlCard
              showAppearance={boardView !== "3d" || !collection3D}
                botLevelLabel={botLevel.label}
                botMode={botMode}
                appearancePreset={appearancePreset}
                appearanceOptions={appearanceOptions}
                boardTheme={boardTheme}
                boardThemeOptions={boardThemeOptions}
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
                onAppearancePresetChange={changeAppearancePreset}
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
                suggestedMoveReady={Boolean(suggestedMove)}
                variantKey={displayState.variantKey}
              />
              <div className="play-table-card">
                {thinking.status === "thinking" ? <p className="mt-1 text-sm font-bold text-[var(--info)]">{thinking.label}</p> : null}
                {isOnlineMode ? (
                  <div className="online-search-card" role="status" aria-label="Online matchmaking status">
                    <Swords size={18} />
                    <div>
                      <strong>
                        {playMode === "room"
                          ? roomCreation.status === "creating"
                            ? "Creating room code"
                            : friend.room?.arrival ? friend.room.arrival.status === "waiting" ? "Waiting for arrival" : "Match closed" : friend.room?.playerCount === 2 ? friend.room.matched ? "Opponent connected" : "Friend connected" : "Invite room ready"
                          : matchmaking.status === "matched"
                            ? "Opponent matched"
                            : "Auto-matching opponent"}
                      </strong>
                      <span>
                        {playMode === "room"
                          ? roomCreation.status === "creating"
                            ? "Generating a room code for invites and spectator links."
                            : roomCreation.status === "ready"
                              ? friend.room?.arrival ? friend.room.arrival.status === "waiting" ? "Play begins when both players connect." : "No game was played. Choose another opponent above." : friend.room?.matched ? "Casual match · both seats are reserved. Share the spectator link to invite viewers." : `Room ${roomCreation.roomId} is ready. Use Share for invite and spectator links.`
                              : roomCreation.status === "failed"
                                ? roomCreation.message
                                : "Use Share to copy an invite link, spectator link, or room code."
                          : matchmaking.status === "matched"
                            ? `Room ${matchmaking.roomId} is active.`
                            : matchmaking.status === "queued"
                              ? `Looking for a ${getTimeControl(timeControl).label} opponent.`
                              : matchmaking.status === "failed"
                                ? matchmaking.message
                                : `Casual ${getTimeControl(timeControl).label} pairs by game and clock.`}
                      </span>
                      {playMode === "online" ? (
                        <div className="online-queue-tags" aria-label="Online queue details">
                          <span>{getTimeControl(timeControl).label}</span>
                          <span>Casual</span>
                          {onlineTicketLabel ? <span>{onlineTicketLabel}</span> : null}
                          <span>{displayState.variantKey}</span>
                        </div>
                      ) : null}
                    </div>
                    {playMode === "online" && matchmaking.status !== "matched" ? (
                      <button type="button" className="focus-ring online-search-cancel" disabled={cancellingSearch} onClick={() => void cancelOnlineSearch()}>
                        <X size={14} />
                        <span>Cancel</span>
                      </button>
                    ) : null}
                  </div>
                ) : isBotMode ? (
                  <>
                    <div className="studio-bot-choice" title={`${botStrength.display} · ${botCalibrationLabel}`}>
                      <Bot size={18} />
                      <div>
                        <strong>Opponent strength</strong>
                        <span title={botStrength.basis}>{botStrength.display}</span>
                      </div>
                      <ChoicePicker label="Bot difficulty" value={botDifficulty} onChange={setBotDifficulty} options={botDifficultyLevels.map(level => ({ key: level.key, label: level.label }))} />
                    </div>
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
                <span className="review-title">
                  <Brain size={16} className="text-[var(--accent)]" />
                  Moves
                </span>
                <span className="review-summary-pills" aria-label="Move review summary">
                  {isReviewing ? <em>Reviewing</em> : null}
                  <span data-review="best">{reviewSummary.best} Best</span>
                  <span data-review="excellent">{reviewSummary.excellent} Excellent</span>
                  <span data-review="blunder">{reviewSummary.blunder} Blunder</span>
                </span>
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
                    <span className="review-move-side" data-owner={firstColor}>{colorLabel(firstColor).slice(0, 2)}</span>
                    <strong>Starting position</strong>
                  </button>
                </li>
                {reviewMoveRows.length ? (
                  reviewMoveRows.map((move) => (
                    <li key={`${move.notation}-${move.ply}`} className={displayPly === move.ply ? "is-active" : ""} data-review={move.classification}>
                      <button type="button" onClick={() => setReviewCursor(move.ply)} className="focus-ring" aria-label={`Review move ${move.ply} ${move.sideLabel} ${move.pieceLabel} ${move.routeLabel} ${move.notation}`}>
                        <span className="review-move-side" data-owner={move.owner}>{move.sideLabel.slice(0, 2)}</span>
                        <span className="review-move-piece">
                          {move.piece ? <PieceIcon code={move.piece.code} owner={move.piece.owner} pieceSkin={pieceSkin} variantKey={displayState.variantKey} locale={locale} promoted={move.piece.promoted} /> : null}
                          <strong>{move.notation}</strong>
                        </span>
                        <span className="review-move-meta">
                          <small>{move.routeLabel}</small>
                          <em>{move.label}</em>
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li>
                    <button type="button" className="focus-ring" disabled>
                      <span className="review-move-side" data-owner={state.turn}>{colorLabel(state.turn).slice(0, 2)}</span>
                      <strong>No moves yet</strong>
                    </button>
                  </li>
                )}
              </ol>
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
                    Back to current
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        {playMode === "room" ? <FriendChat room={friend.room} busy={friend.busy || friend.connection !== "connected"} onSend={text => friend.send({ action: "chat", text })} /> : <details className="studio-chat-disclosure">
          <summary className="focus-ring">{playMode === "bot" || playMode === "offline" ? "Local chat" : "Room chat"}<span>Open conversation</span></summary>
          <p className="studio-chat-note">Messages stay on this device.</p>
          <PlayChatPanel key={`${playMode}-${chatRoomId}`} gameStarted={gameStarted} isSpectating={isSpectating} locale={locale} playMode={playMode} roomId={chatRoomId} title={title} variantKey={displayState.variantKey} />
        </details>}
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
