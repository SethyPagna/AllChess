"use client";

import { useLocalMatch } from "./use-local-match";
import { SavedMatches } from "./saved-matches";
import { readLocalMatch } from "@/lib/game/local-match-store";
import { historicalPieceHint } from "./historical-piece";
import { jungleRank, jungleTrapOwner, restoreJungleOpening, usesJungleStandardRules } from "@/lib/variants/jungle-profile";
import { restoreKonaneOpening, usesKonaneNpsRules } from "@/lib/variants/konane-profile";
import { restoreHordeOpening } from "@/lib/variants/horde-profile";
import { restoreShatranjOpening } from "@/lib/variants/shatranj-profile";
import type { LocalMatchSnapshot } from "@/lib/game/local-match";
import { downloadLocalMatch } from "@/lib/game/local-match-transfer";
import { FriendChat } from "./friend-chat";
import { MatchArrivalPanel } from "./match-arrival-panel";
import { useFriendRoom, saveFriendToken } from "./use-friend-room";
import type { FriendRoomView } from "@/lib/realtime/friend-room";
import dynamic from "next/dynamic";
import { piece2DSkin, pieceSetModelPath, pieceSetOptions, readPiece2DStylePreference, readPieceSetPreference, resolvePiece2DStyle, resolvePieceSet, type Piece2DStyle, type PieceSetId } from "./piece-sets";
import { MakrukCountingPanel, MakrukEndgamePicker } from "./makruk-counting-panel";
import { applyMakrukCountAction, readMakrukHonorCount, makrukCountVersion, replayMakrukCountActions, usesMakrukHonorCount, type MakrukCountAction } from "@/lib/variants/makruk-counting";
import { createMakrukEndgame, makrukEndgames, type MakrukEndgameKey } from "@/lib/variants/makruk-endgames";
import { prepareMakrukBotTurn } from "@/lib/bot/makruk-counting";
import { OukCountingPanel, OukEndgamePicker } from "./ouk-counting-panel";
import { applyOukCountAction, readOukCount, type OukCountAction } from "@/lib/variants/ouk-counting";
import { prepareOukBotTurn } from "@/lib/bot/ouk-counting";
import { createOukEndgame, oukEndgames, type OukEndgameKey } from "@/lib/variants/ouk-endgames";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import { LogOut, X } from "lucide-react";

import { getBotDifficultyLevel, MAX_BOT_REPLY_MS, type BotDifficultyKey } from "@/lib/bot/config";
import { getVariantBotStrengthProfile } from "@/lib/bot/strength";
import type { BotMoveResult } from "@/lib/bot/runtime";
import { getCatalogModeSupport, getGameCatalogEntry, type CatalogModeSupport } from "@/lib/catalog";
import { applyBotMoveAfterThinking, botReplyHistoryFrame, withoutFlaggedBotFrame } from "@/lib/game/bot-clock";
import { tickGameClock } from "@/lib/game/clocks";
import { redoTimeline, redoTimelineUntil, undoTimeline, undoTimelineUntil } from "@/lib/game/history";
import { formatTimelineNotation } from "@/lib/game/notation";
import { createMoveSuggestion, resolveMoveSuggestion, suggestionSelection, type MoveSuggestion } from "@/lib/game/move-suggestion";
import { buildMoveTimeline, type MoveTimelineEntry } from "@/lib/game/review";
import { describeGameOutcome } from "@/lib/game/outcome";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVocabulary } from "@/lib/i18n/vocabulary";
import type { VariantRuleSummary } from "@/lib/variants/rules-atlas";
import { getTimeControl, type TimeControlKey } from "@/lib/game/time-controls";
import { JanggiLocalSetup, JanggiRoomSetup } from "./janggi-formation-picker";
import { copyJanggiFormations, pendingJanggiSide, readJanggiFormations, restoreJanggiOpening, withJanggiFormation, type JanggiFormation, type JanggiSide } from "@/lib/variants/janggi-formations";
import { applyMove, createInitialState, findLegalMove, getLegalMoves, getVariant, restoreChess960Opening, sameSquare, serializeSquare, type GameState, type Move, type Piece, type Square } from "@/lib/variants";
import { BoardGrid } from "@/components/board/board-grid";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { BoardPlayerCard } from "@/components/board/board-player-card";
import { getDropRuleNote } from "@/components/board/drop-guidance";
import { GameGuideModal } from "@/components/board/game-guide-modal";
import { MatchResultOverlay } from "@/components/board/match-result-overlay";
import { isAppearancePresetPreference, resolveAppearancePreset, type AppearancePresetPreference } from "@/components/board/appearance";
import { PieceIcon, getPieceDisplayName, type PieceSkinPreference } from "@/components/board/piece-icon";
import { PlayChatPanel } from "@/components/board/play-chat-panel";
import { PlayControlCard } from "@/components/board/play-control-card";
import { PlayMatchHeader } from "@/components/board/play-match-header";
import { PlayPregameSetupCard } from "@/components/board/play-pregame-setup-card";
import { playModeOptions, type PlayMode } from "@/components/board/game-board-options";
import { colorLabel, pickHumanColor, quickSuggestionMove, resignationResult, squareName, withTimeControl } from "@/components/board/game-board-utils";
import { PlayMoveList } from "@/components/board/play-move-list";

import { collectionModelPath, get3DCollection, isPieceFinish, type PieceFinish } from "./board-3d-config";

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

type SuggestedMove = MoveSuggestion;

export type PromotionOption = {
  move: Move;
  code: string;
  promoted: boolean;
  label: string;
  actionLabel: string;
};

type PendingPromotion = {
  options: PromotionOption[];
  pieceLabel: string;
  pieceOwner: Piece["owner"];
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

type ReviewMoveRow = MoveTimelineEntry & {
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
  moves: MoveTimelineEntry[];
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

/** Western games read best as plain SAN; elsewhere the piece icon carries the piece, so the letter is dropped. */
function moveListEntry(move: ReviewMoveRow, notation: string | undefined, western: boolean) {
  const base = { ply: move.ply, pieceLabel: move.pieceLabel };
  if (move.kind === "pass" || notation === "pass") return { ...base, text: "Pass", piece: null };
  if (notation && western) return { ...base, text: notation, piece: null };
  if (notation) return { ...base, text: move.piece ? notation.replace(/^\+?[A-Z](?=[a-z*x])/, "") : notation, piece: move.piece };
  return { ...base, text: move.captureCount ? move.routeLabel.replace("-", "×") : move.routeLabel, piece: move.piece };
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
  onCancel?: () => void;
  onChoose: (move: Move) => void;
  options: PromotionOption[];
  pieceLabel: string;
  pieceOwner: Piece["owner"];
  pieceSkin: PieceSkinPreference;
  variantKey: string;
};

type TerrainKey = Exclude<NonNullable<GameState["board"][number][number]["terrain"]>, "land">;

type TerrainKeyLegendProps = {
  terrainKeys: TerrainKey[];
  locale?: string;
};

// Promotion zones and palaces are named on each square and in the guide; only terrain that changes how pieces move gets a key.
const keyedTerrain: TerrainKey[] = ["river", "den", "trap", "camp"];

/** One button per legal outcome: promote/keep for optional promotions, or the piece to become (Q/R/B/N) in Western chess. */
export function PromotionChoiceCard({ locale, onCancel, onChoose, options, pieceLabel, pieceOwner, pieceSkin, variantKey }: PromotionChoiceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // The choice blocks the move, so focus goes straight to it; Escape backs out to the board.
  useEffect(() => { cardRef.current?.querySelector("button")?.focus({ preventScroll: true }); }, []);
  return (
    <div
      ref={cardRef}
      className="promotion-choice-card"
      role="dialog"
      aria-label={`${pieceLabel} promotion choice`}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !onCancel) return;
        event.stopPropagation();
        onCancel();
      }}
    >
      <span>
        <strong>{pieceLabel}</strong>
        <small>Choose promotion</small>
      </span>
      <div data-count={options.length}>
        {options.map((option) => (
          <button key={option.actionLabel} type="button" className="focus-ring" aria-label={option.actionLabel} title={option.actionLabel} onClick={() => onChoose(option.move)}>
            <PieceIcon code={option.code} owner={pieceOwner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} promoted={option.promoted} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TerrainKeyLegend({ terrainKeys, locale = "en" }: TerrainKeyLegendProps) {
  if (!terrainKeys.length) return null;
  const terrainLabels = getVocabulary(normalizeLocale(locale)).terrain;
  return (
    <div className="terrain-key" aria-label="Board terrain key">
      <span className="sr-only">Zones</span>
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
  const [recordedHistory, setHistory] = useState<GameState[]>([]);
  // A bot reply can land just after the live clock flagged the bot and record that turn a second time.
  const history = useMemo(() => withoutFlaggedBotFrame(recordedHistory, state), [recordedHistory, state]);
  const [future, setFuture] = useState<GameState[]>([]);
  const [boardView, setBoardView] = useState<"2d" | "3d">("2d");
  const [pieceFinish, setPieceFinish] = useState<PieceFinish>("original");
  const [pieceSet, setPieceSet] = useState<PieceSetId>(() => resolvePieceSet(variantKey, null));
  const [piece2DStyle, setPiece2DStyle] = useState<Piece2DStyle>("collection");
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
  const [notice, setNotice] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(true);
  const [showRules, setShowRules] = useState(false);
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
      let position = restoreShatranjOpening(restoreHordeOpening(restoreChess960Opening(restoreJungleOpening(restoreKonaneOpening(restoreJanggiOpening(createInitialState(variantKey, room.state.id), room.state), room.state), room.state), room.state), room.state), room.state);
      if (variantKey === "makruk" && !usesMakrukHonorCount(room.state)) delete position.variantState;
      const frames: GameState[] = [];
      for (const move of room.state.moves) {
        position = replayMakrukCountActions(position, room.state);
        frames.push(position);
        if (position.status !== "active") break;
        // Rooms recorded before a rules fix can hold a move the engine now rejects; keep the
        // history up to it rather than failing the whole sync (the live board is room.state).
        try { position = applyMove(position, move); } catch { break; }
      }
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
    setSelected(null); setSelectedHandCode(null); setPendingPromotion(null); setSuggestedMove(null);
    setThinking({ status: "idle", label: "" }); setReviewPly(null); setReviewPlaying(false); setShowOutcome(false); setNotice(null); setRestoreError("");
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
      setPieceSet(readPieceSetPreference(variantKey));
      setPiece2DStyle(readPiece2DStylePreference(variantKey));
      setBoardView("2d");
      setPieceFinish("original");
      try {
        setBoardView(get3DCollection(variantKey) && localStorage.getItem(`allchess-board-view:${variantKey}`) === "3d" ? "3d" : "2d");
      } catch { /* Keep the accessible 2D default. */ }
      try {
        const finish = localStorage.getItem(`allchess-piece-finish:${variantKey}`);
        setPieceFinish(isPieceFinish(finish) ? finish : "original");
      } catch { /* Keep this game's original finish. */ }
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
  const reviewMoves = useMemo(() => buildMoveTimeline(state.moves, timeline), [state.moves, timeline]);
  const displayPly = reviewPly ?? timeline.length - 1;
  const displayState = timeline[Math.min(displayPly, timeline.length - 1)] ?? state;
  const isReviewing = reviewPly !== null;
  const terrainKeys = useMemo(() => {
    const present = new Set<TerrainKey>();
    for (const row of displayState.board) {
      for (const cell of row) {
        if (cell.terrain && cell.terrain !== "land") present.add(cell.terrain);
      }
    }
    return keyedTerrain.filter((terrain) => present.has(terrain));
  }, [displayState.board]);
  const selectedHandPiece = useMemo(() => (selectedHandCode ? createHandDropPiece(state.turn, selectedHandCode) : null), [selectedHandCode, state.turn]);
  const legalMoves = useMemo(() => (selected ? getLegalMoves(state, selected) : selectedHandPiece ? getLegalMoves(state, { drop: selectedHandPiece }) : []), [selected, selectedHandPiece, state]);
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => serializeSquare(move.to))), [legalMoves]);
  const selectedHandLabel = selectedHandCode ? getPieceDisplayName(selectedHandCode, variantKey, locale) : null;
  const botColor = state.clocks.find((clock) => clock.color !== humanColor)?.color ?? state.clocks[1]?.color ?? "black";
  const rows = displayState.board.length;
  const cols = displayState.board[0]?.length ?? 8;
  const files = useMemo(() => Array.from({ length: cols }, (_, index) => String.fromCharCode(97 + index)), [cols]);
  const moveNotations = useMemo(() => formatTimelineNotation(timeline, state.moves), [state.moves, timeline]);
  const reviewMoveRows = useMemo(() => buildReviewMoveRows({ files, locale, moves: reviewMoves, rawMoves: state.moves, rows, timeline, variantKey: displayState.variantKey }), [displayState.variantKey, files, locale, reviewMoves, rows, state.moves, timeline]);
  const botLevel = getBotDifficultyLevel(botDifficulty);
  const appearance = useMemo(() => resolveAppearancePreset(variantKey, appearancePreset), [appearancePreset, variantKey]);
  const boardTheme = appearance.boardTheme;
  const pieceSkin = piece2DSkin(variantKey, pieceSet, appearance.pieceSkin, piece2DStyle);
  const pieceSetLabel = pieceSetOptions(variantKey).find(option => option.key === pieceSet)?.finishLabel;
  const supportsDrops = useMemo(() => getVariant(variantKey).supportsDrops, [variantKey]);
  const botStrength = useMemo(() => getVariantBotStrengthProfile(variantKey, botDifficulty), [botDifficulty, variantKey]);
  const botCalibrationLabel = botStrength.calibrationStatus.replace(/-/g, " ");
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
        playerLabel={isBotSeat ? undefined : localGame ? (botMode === "opponent" ? undefined : colorLabel(color)) : guestName}
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

  function changePieceSet(next: PieceSetId) {
    const value = resolvePieceSet(variantKey, next);
    setPieceSet(value);
    try { localStorage.setItem(`allchess-piece-set:${variantKey}`, value); } catch { /* Session fallback. */ }
  }

  function changePiece2DStyle(next: Piece2DStyle) {
    const value = resolvePiece2DStyle(variantKey, next);
    setPiece2DStyle(value);
    try { localStorage.setItem(`allchess-piece-2d-style:${variantKey}`, value); } catch { /* Session fallback. */ }
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

  function passTurn() {
    if (!canHumanMove()) return;
    const move = findLegalMove(state, { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } });
    if (move) commitPlayerMove(move);
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
    const pieceChoices = candidates.filter((candidate) => candidate.promoteTo !== undefined);
    const promoteMove = candidates.find((candidate) => candidate.promotion === true);
    const keepMove = candidates.find((candidate) => candidate.promotion !== true);
    if (piece && (pieceChoices.length > 1 || (promoteMove && keepMove))) {
      const pieceLabel = getPieceDisplayName(piece.code, variantKey, locale, piece.promoted);
      const options: PromotionOption[] = pieceChoices.length > 1
        ? pieceChoices.map((move) => {
            const label = getPieceDisplayName(move.promoteTo!, variantKey, locale);
            return { move, code: move.promoteTo!, promoted: false, label, actionLabel: `Promote to ${label}` };
          })
        : [
            { move: promoteMove!, code: piece.code, promoted: true, label: `Promote to ${getPieceDisplayName(piece.code, variantKey, locale, true)}`, actionLabel: `Promote to ${getPieceDisplayName(piece.code, variantKey, locale, true)}` },
            { move: keepMove!, code: piece.code, promoted: false, label: `Keep ${pieceLabel}`, actionLabel: `Keep ${pieceLabel}` }
          ];
      setPendingPromotion({ options, pieceLabel, pieceOwner: piece.owner });
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
      setPendingPromotion(null);
      return;
    }
    if (isReviewing) {
      setNotice("You are reviewing an earlier position. Press the last-move button to return to the game.");
      setPendingPromotion(null);
      return;
    }
    if (isOnlineMode && !isMatchedOnlineGame) {
      setNotice("Searching for opponent. Board moves unlock after a live opponent is paired.");
      setPendingPromotion(null);
      return;
    }
    if (isSpectating) {
      setNotice("Spectate mode is read-only. Choose a playable mode to move pieces.");
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

  function focusBoardSquare(square: Square) {
    document.querySelector<HTMLButtonElement>(`.board-grid [data-square="${squareName(square, files, rows)}"]`)?.focus({ preventScroll: true });
  }

  function choosePromotion(move: Move) {
    if (!pendingPromotion) return;
    // The clock may have run out while the picker was open; the move can no longer be played.
    if (state.status !== "active") {
      setPendingPromotion(null);
      return;
    }
    commitPlayerMove(move);
    focusBoardSquare(move.to);
  }

  function cancelPromotion() {
    const from = pendingPromotion?.options[0]?.move.from;
    setPendingPromotion(null);
    if (from) focusBoardSquare(from);
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
      const historySnapshot = botReplyHistoryFrame(snapshot, result.elapsedMs);
      if (historySnapshot) setHistory((current) => [...current, historySnapshot]);
      setFuture([]);
      setState((current) => applyBotMoveAfterThinking(current, snapshot, move, result.elapsedMs));
      setSuggestedMove(null);
      // No frame means the bot's clock ran out while it was thinking, so the move was never played.
      setNotice(!historySnapshot ? "The bot ran out of time." : source === "auto" ? "Bot replied automatically." : "Bot played the current side.");
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
    if (!canUseAssist || activeBotRequestRef.current) return;
    const quickMove = quickSuggestionMove(state);
    if (quickMove) {
      setSuggestedMove(createMoveSuggestion(state, quickMove));
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
      setSuggestedMove(null);
      setNotice("No legal moves are available.");
      return;
    }
    setSuggestedMove(createMoveSuggestion(state, result.move, result.score, result.depthReached));
    const selection = suggestionSelection(result.move);
    setSelected(selection.square);
    setSelectedHandCode(selection.handCode);
    setNotice(null);
  }

  function applySuggestion() {
    if (!canUseAssist || !suggestedMove) return;
    const move = resolveMoveSuggestion(state, suggestedMove);
    if (!move) {
      setNotice("That suggestion is no longer legal.");
      setSuggestedMove(null);
      return;
    }
    commitPlayerMove(move);
    setNotice("Suggestion applied.");
  }

  /** Switching a bot mode off is always allowed and stops any search it started. */
  function toggleBotMode(mode: "opponent" | "both") {
    if (botMode === mode) {
      if (activeBotRequestRef.current) cancelThinking();
      setBotMode("human");
      return;
    }
    setBotMode(mode);
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
    const result = resignationResult(state, humanColor, isBotMode && botMode === "opponent");
    setState((current) => ({
      ...current,
      status: "completed",
      result,
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
    setNotice(null);
    setThinking({ status: "idle", label: "" });
    setShowOutcome(false);
    setReviewPly(null);
    setReviewPlaying(false);
    setMatchmaking({ status: "idle" });
    setRoomCreation({ status: "idle" });
  }

  /** Reset from a control that unmounts with the game, so keyboard focus lands on the setup's Start button. */
  function returnToSetup() {
    reset();
    window.requestAnimationFrame(() => sidePanelRef.current?.querySelector<HTMLElement>(".play-start-button")?.focus());
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
      setState(current => ({ ...current, status: "waiting" })); setGameStarted(true);
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
    setNotice(null);
    setThinking({ status: "idle", label: "" });
    setShowOutcome(false);
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
    setNotice(null);
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
    setNotice(
      playMode === "online"
        ? "Finding an opponent for a casual game. Sides are assigned when paired."
        : playMode === "room"
          ? inviteRoomId?.trim() ? "Connecting to your friend room…" : "Creating your friend room…"
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
      setMatchmaking({ status: "idle" }); setGameStarted(false); setState(current => ({ ...current, status: "waiting" }));
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
    }
    setNotice(null);
  }

  function flipBoard() {
    setBoardOrientation((current) => (current === "second" ? "first" : "second"));
  }

  function startReview() {
    setReviewPly(0);
    setReviewPlaying(false);
    setSelected(null);
    setSelectedHandCode(null);
    setSuggestedMove(null);
    setNotice(null);
  }

  function jumpToLive() {
    setReviewPly(null);
    setReviewPlaying(false);
    setSelectedHandCode(null);
    setNotice(null);
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

  // The live clock can flag the bot mid-search; its late reply must not play a move.
  useEffect(() => {
    const requestId = activeBotRequestRef.current;
    if (state.status === "active" || !requestId) return;
    cancelRuntimeBotMove(requestId);
    activeBotRequestRef.current = null;
    setThinking({ status: "idle", label: "" });
  }, [state.status]);

  const historicalHint = historicalPieceHint(variantKey, selected ? displayState.board[selected.row]?.[selected.col]?.piece?.code : undefined);
  const selectedAnimal = variantKey === "jungle" && selected ? displayState.board[selected.row]?.[selected.col]?.piece : null;
  const trappedAnimal = selectedAnimal && selected && usesJungleStandardRules(displayState) && jungleTrapOwner(selected) && jungleTrapOwner(selected) !== selectedAnimal.owner;
  const animalHint = selectedAnimal ? `${getPieceDisplayName(selectedAnimal.code, variantKey, locale)} · ${trappedAnimal ? "in enemy trap · any animal can capture it" : `rank ${jungleRank(selectedAnimal.code, usesJungleStandardRules(displayState))} · ${selectedAnimal.code === "r" ? "swims · captures elephants on land" : ["l", "t"].includes(selectedAnimal.code) ? "jumps rivers unless a rat blocks the way" : "one square horizontally or vertically"}`}` : "";

  const showSaveBar = gameStarted && localGame && (localPaused || localSave.status === "error" || localSave.status === "conflict");
  const view3DLabel = collection3D === "jungle" ? "3D animals" : collection3D === "shatranj" ? "3D ceramic" : collection3D === "konane" ? "3D stones" : collection3D === "draughts" ? "3D counters" : collection3D === "xiangqi" ? "3D discs" : collection3D === "shogi" || collection3D === "janggi" ? "3D tiles" : "3D carved";
  const originalFinishLabel = pieceSetLabel ?? (collection3D === "jungle" ? "Ivory & jade" : collection3D === "shatranj" ? "Stonepaste" : collection3D === "chaturanga" ? "Sandalwood & rosewood" : collection3D === "konane" ? "Natural stone" : collection3D === "shogi" || collection3D === "xiangqi" ? "Boxwood" : collection3D === "janggi" ? "Ivory" : collection3D === "makruk" ? "Thai lacquer" : "Original");
  const moveListEntries = reviewMoveRows.map((move) => moveListEntry(move, moveNotations[move.ply - 1], getVariant(displayState.variantKey).family === "western"));
  const statusNote = thinking.status === "thinking" ? thinking.label : notice ?? (suggestedMove ? `Hint: ${suggestedMove.notation}` : null);
  function exportLocalGame() {
    try { downloadLocalMatch(localSnapshot); setRestoreError(""); } catch (cause) { setRestoreError(cause instanceof Error ? cause.message : "This game could not be exported."); }
  }
  function toggleReviewPlayback() {
    if (!reviewPlaying && reviewPly === null) setReviewPly(0);
    setReviewPlaying((current) => !current);
  }

  if (boardView === "3d" && collection3D) {
    preload(pieceSetModelPath(collection3D, pieceSet) ?? collectionModelPath(collection3D), { as: "fetch", crossOrigin: "anonymous" });
  }

  return (
    <div className="game-board-layout game-studio" data-focus={focusMode && gameStarted ? "true" : undefined} data-started={gameStarted ? "true" : undefined} style={{ "--board-ratio": cols / rows } as CSSProperties}>
      <div className="board-column">
        {restoreError ? <p className="local-save-error" role="alert">{restoreError}</p> : null}
        {showSaveBar ? <div className="local-save-bar" role="status" aria-label="Local save status">
          <span>{localSave.status === "error" || localSave.status === "conflict" ? localSave.error : "Paused · your clock waits for you"}</span>
          {localSave.status === "conflict" ? <><button type="button" className="focus-ring" onClick={() => void reloadLocalSave()}>Open latest save</button><button type="button" className="focus-ring" onClick={keepLocalCopy}>Keep this board as a copy</button></> : <>
            {localSave.status === "error" ? <button type="button" className="focus-ring" onClick={() => localSave.retry(localSnapshot)}>Retry save</button> : null}
            {localPaused && state.status === "active" ? <button type="button" className="focus-ring action-primary" onClick={() => setLocalPaused(false)}>Resume game</button> : null}
          </>}
        </div> : null}
        <BoardToolbar
          pieceSet={pieceSet}
          onPieceSetChange={changePieceSet}
          piece2DStyle={piece2DStyle}
          onPiece2DStyleChange={changePiece2DStyle}
          is3D={boardView === "3d" && !!collection3D}
          variantKey={variantKey}
          appearancePreset={appearancePreset}
          onAppearanceChange={changeAppearancePreset}
          onFlip={flipBoard}
          focusMode={focusMode && gameStarted}
          onFocusChange={() => setFocusMode((current) => !current)}
          canFocus={gameStarted}
          viewControls={collection3D ? (
            <div className="segmented board-view-toggle" role="group" aria-label="Board view">
              <button type="button" className="focus-ring" aria-label="2D board" aria-pressed={boardView === "2d"} onClick={() => changeBoardView("2d")}>2D</button>
              <button type="button" className="focus-ring" aria-label={view3DLabel} aria-pressed={boardView === "3d"} onClick={() => changeBoardView("3d")}>3D</button>
            </div>
          ) : null}
          panelControls={boardView === "3d" && collection3D ? (
            <>
              <div className="board-look-heading"><strong>Material</strong></div>
              <div role="group" aria-label="Piece material" className="board-finish-buttons">
                {(["original", "porcelain", "slate"] as const).map(finish => <button key={finish} type="button" className="focus-ring" aria-pressed={pieceFinish === finish} onClick={() => changePieceFinish(finish)}>{finish === "original" ? originalFinishLabel : finish === "porcelain" ? "Porcelain" : "Slate"}</button>)}
              </div>
            </>
          ) : null}
        />
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
        {variantKey === "konane" && gameStarted ? <p className="konane-play-hint" role="status">{!usesKonaneNpsRules(displayState) ? "Legacy save · adjacent second removal and forced jump continuation" : displayState.ply < 2 ? `${displayState.turn === "black" ? "Black" : "White"} removes one own stone · tap it twice` : "Choose a landing point · jump once or farther in the same straight line"}</p> : null}
        {variantKey === "makruk" && gameStarted ? <MakrukCountingPanel state={displayState} actor={playMode === "room" ? friend.room?.seat ?? state.turn : botMode === "opponent" ? humanColor : state.turn} localTwoPlayer={!isOnlineMode && !isSpectating && botMode === "human"} disabled={localPaused || isReviewing || isSpectating || botMode === "both" || (isOnlineMode && playMode !== "room") || (playMode === "room" && (friend.busy || friend.connection !== "connected" || !friend.room?.seat))} onAction={changeMakrukCount} /> : null}
        {variantKey === "ouk-chaktrang" && gameStarted ? <OukCountingPanel state={displayState} actor={botMode === "opponent" ? humanColor : state.turn} localTwoPlayer={!isOnlineMode && !isSpectating && botMode === "human"} disabled={localPaused || isReviewing || isOnlineMode || isSpectating || botMode === "both"} onAction={changeOukCount} /> : null}
        <div className="board-shell" data-view={boardView === "3d" && collection3D ? "3d" : "2d"} data-variant={displayState.variantKey} data-board-theme={boardTheme} data-piece-set={pieceSet} data-board-orientation={visualOrientation} data-variant-size={`${cols}x${rows}`} style={{ "--board-cols": cols, "--board-rows": rows } as CSSProperties}>
          <div className="board-stage">
            {boardView === "3d" && collection3D ? <Board3D key={`${variantKey}:${pieceSet}`} pieceSet={pieceSet} collection={collection3D} variantKey={variantKey} orientedRows={orientedRows} legalTargets={legalTargets} selected={selected} onChoose={choose} boardTheme={boardTheme} lastMove={displayState.moves.at(-1)} finish={pieceFinish} hands={displayState.hands} selectedHand={!isReviewing && selectedHandCode ? { owner: state.turn, code: selectedHandCode } : null} onChooseHand={chooseHandPiece} onFallback={() => changeBoardView("2d")} /> : <BoardGrid cols={cols} files={files} legalTargets={legalTargets} legalTargetMode={selectedHandPiece ? "drop" : "move"} locale={locale} onChoose={choose} onDragMove={dragBoardMove} onDropHandPiece={dropHandPiece} orientedRows={orientedRows} pieceSkin={pieceSkin} rows={rows} selected={selected} suggestedMove={suggestedMove} lastMove={displayState.moves.at(-1)} variantKey={displayState.variantKey} />}
            {selectedHandCode && selectedHandLabel ? <DropSelectionHint legalTargetCount={legalTargets.size} locale={locale} onCancel={cancelHandDrop} pieceCode={selectedHandCode} pieceLabel={selectedHandLabel} pieceOwner={state.turn} pieceSkin={pieceSkin} variantKey={displayState.variantKey} /> : null}
            {pendingPromotion && state.status === "active" ? (
              <PromotionChoiceCard locale={locale} onCancel={cancelPromotion} onChoose={choosePromotion} options={pendingPromotion.options} pieceLabel={pendingPromotion.pieceLabel} pieceOwner={pendingPromotion.pieceOwner} pieceSkin={pieceSkin} variantKey={displayState.variantKey} />
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
        {historicalHint || animalHint ? <p className="historical-piece-hint" role="status">{historicalHint || animalHint}</p> : null}
        {variantKey === "jungle" && (boardView === "3d" || !usesJungleStandardRules(displayState)) ? <p className="historical-piece-hint" aria-label="Board terrain key">{boardView === "3d" ? "≈ River · × Trap · ○ Den" : ""}{!usesJungleStandardRules(displayState) ? `${boardView === "3d" ? " · " : ""}Legacy saved rules` : ""}</p> : null}
        {playerCard(bottomPlayerColor, "bottom")}
      </div>

      <aside ref={sidePanelRef} className="game-side-panel play-panel">
        <PlayMatchHeader
          localOnly={localOnly}
          currentVariantKey={variantKey}
          locale={locale}
          onOpenGuide={() => setShowRules(true)}
          onSelectRoom={() => selectPlayMode("room")}
          onSelectWatch={() => selectPlayMode("spectate")}
          playMode={playMode}
          roomId={chatRoomId}
          showGuide={Boolean(rulesSummary)}
          timeControl={timeControl}
          title={title}
        />
        {gameStarted ? (
          <>
            <div className="match-meta" aria-label="Match details">
              <span>{modeDetails.label}</span>
              {isBotMode ? <span title={`${botStrength.display} · ${botCalibrationLabel}`}>{botLevel.label}</span> : null}
              <span>{getTimeControl(timeControl).label}</span>
              {localGame ? <span className="match-save" data-state={localSave.status}>{localSave.status === "error" || localSave.status === "conflict" ? "Not saved" : localSave.status === "saved" ? "Saved" : "Saving…"}</span> : null}
              {isSpectating ? <button type="button" className="focus-ring icon-btn match-exit" aria-label="Stop watching" title="Stop watching" onClick={returnToSetup}><LogOut size={15} /></button> : null}
            </div>
            {isOnlineMode ? (
              <div className="online-search-card" role="status" aria-label="Online matchmaking status">
                <div>
                  <strong>
                    {playMode === "room"
                      ? roomCreation.status === "creating"
                        ? "Creating room…"
                        : roomCreation.status === "failed" ? "Room unavailable"
                        : friend.room?.arrival ? friend.room.arrival.status === "waiting" ? "Waiting for arrival" : "Match closed" : friend.room?.playerCount === 2 ? friend.room.matched ? "Opponent connected" : "Friend connected" : "Room ready"
                      : matchmaking.status === "matched"
                        ? "Opponent matched"
                        : "Finding an opponent…"}
                  </strong>
                  <span>
                    {playMode === "room"
                      ? roomCreation.status === "ready"
                        ? friend.room?.arrival ? friend.room.arrival.status === "waiting" ? "Play begins when both players connect." : "No game was played." : friend.room?.playerCount === 2 ? "Both seats are taken." : "Use Share to send the invite link."
                        : roomCreation.status === "failed" ? roomCreation.message : "Preparing invite and spectator links."
                      : matchmaking.status === "matched"
                        ? `Room ${matchmaking.roomId.slice(0, 8)}`
                        : matchmaking.status === "failed"
                          ? matchmaking.message
                          : `${getTimeControl(timeControl).label} · casual${onlineTicketLabel ? ` · ${onlineTicketLabel}` : ""}`}
                  </span>
                </div>
                {playMode === "online" && matchmaking.status !== "matched" ? (
                  <button type="button" className="focus-ring action-secondary" disabled={cancellingSearch} onClick={() => void cancelOnlineSearch()}>
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <PlayMoveList
              entries={moveListEntries}
              activePly={displayPly}
              reviewing={isReviewing}
              playing={reviewPlaying}
              locale={locale}
              pieceSkin={pieceSkin}
              variantKey={displayState.variantKey}
              onSelect={setReviewCursor}
              onLive={jumpToLive}
              onTogglePlay={toggleReviewPlayback}
            />
            {isSpectating ? null : (
              <PlayControlCard
                botMode={botMode}
                canEndGame={canEndGame}
                canRedo={canRedo}
                canUndo={canUndo}
                canUseAssist={canUseAssist}
                canUseBots={canUseBots}
                isThinking={isThinking}
                paused={localPaused}
                suggestedMoveReady={Boolean(suggestedMove)}
                onApplySuggestion={applySuggestion}
                onCancelThinking={cancelThinking}
                onExport={localGame ? exportLocalGame : undefined}
                onMoveForCurrentSide={() => void playBotMove("manual")}
                onOfferDraw={offerDraw}
                onPass={variantKey === "janggi" ? passTurn : undefined}
                canPass={variantKey === "janggi" && canHumanMove() && Boolean(findLegalMove(state, { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } }))}
                onRedo={redo}
                onResign={resignGame}
                onReset={returnToSetup}
                onSuggest={suggestMove}
                onToggleAuto={() => toggleBotMode("both")}
                onToggleBot={() => toggleBotMode("opponent")}
                onTogglePause={localGame && state.status === "active" ? () => (localPaused ? setLocalPaused(false) : pauseLocalGame()) : undefined}
                onUndo={undo}
              />
            )}
            {statusNote ? <p className="play-note" role="status">{statusNote}</p> : null}
            {playMode === "room" ? <FriendChat room={friend.room} busy={friend.busy || friend.connection !== "connected"} onSend={text => friend.send({ action: "chat", text })} /> : isOnlineMode || isSpectating ? (
              <details className="studio-chat-disclosure">
                <summary className="focus-ring">Chat</summary>
                <PlayChatPanel key={`${playMode}-${chatRoomId}`} gameStarted={gameStarted} isSpectating={isSpectating} locale={locale} playMode={playMode} roomId={chatRoomId} title={title} variantKey={displayState.variantKey} />
              </details>
            ) : null}
          </>
        ) : (
          <>
            <PlayPregameSetupCard
              gameSetup={variantKey === "janggi" && localGame ? <JanggiLocalSetup values={readJanggiFormations(state)} onChange={changeJanggiFormation} /> : undefined}
              joiningRoom={Boolean(inviteRoomId)}
              botDifficulty={botDifficulty}
              botLevelLabel={botLevel.label}
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
            {notice ? <p className="play-note" role="status">{notice}</p> : null}
            {localGame && !localOnly ? <SavedMatches locale={locale} variantKey={variantKey} onResume={restoreLocalGame} /> : null}
            {variantKey === "ouk-chaktrang" && localGame ? <OukEndgamePicker onChoose={loadOukEndgame} /> : null}
            {variantKey === "makruk" && localGame ? <MakrukEndgamePicker onChoose={loadMakrukEndgame} /> : null}
          </>
        )}
      </aside>
      <GameGuideModal show={showRules} rulesSummary={rulesSummary} onClose={() => setShowRules(false)} />
    </div>
  );
}
