import { setPieceDragImage } from "@/components/board/drag-preview";
import { getHandPieceHelpText } from "@/components/board/drop-guidance";
import { PieceIcon, getPieceDisplayName, resolvePieceSkin, type PieceSkinPreference } from "@/components/board/piece-icon";
import { colorLabel } from "@/components/board/game-board-utils";
import { formatClock } from "@/lib/game/clocks";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVocabulary } from "@/lib/i18n/vocabulary";
import type { Piece, PlayerClock } from "@/lib/variants";

type BoardPlayerCardProps = {
  botLevelLabel: string;
  botModeActive: boolean;
  botStrengthDisplay: string;
  canUseHand?: boolean;
  capturedPieces: Piece[];
  handCounts?: Record<string, number>;
  opponentCapturedPieces: Piece[];
  clock?: PlayerClock;
  color: string;
  humanColor: string;
  isActive: boolean;
  locale?: string;
  onHandPieceClick?: (code: string) => void;
  pieceSkin?: PieceSkinPreference;
  playerAvatarLabel?: string;
  playerLabel?: string;
  placement: "top" | "bottom";
  selectedHandCode?: string | null;
  supportsDrops?: boolean;
  thinking: boolean;
  timeControl: string;
  variantKey: string;
};

const visibleCaptureLimit = 14;
const handPieceDragType = "application/x-allchess-hand-piece";

export function BoardPlayerCard({
  botLevelLabel,
  botModeActive,
  botStrengthDisplay,
  canUseHand = false,
  capturedPieces,
  handCounts = {},
  opponentCapturedPieces,
  clock,
  color,
  humanColor,
  isActive,
  locale = "en",
  onHandPieceClick,
  pieceSkin = "default",
  playerAvatarLabel,
  playerLabel,
  placement,
  selectedHandCode = null,
  supportsDrops = false,
  thinking,
  timeControl,
  variantKey
}: BoardPlayerCardProps) {
  const isHuman = color === humanColor;
  const isBot = botModeActive;
  const materialAdvantage = Math.max(0, materialValue(capturedPieces) - materialValue(opponentCapturedPieces));
  const visibleCaptures = capturedPieces.slice(0, visibleCaptureLimit);
  const hiddenCaptureCount = Math.max(0, capturedPieces.length - visibleCaptures.length);
  const materialLabel = materialAdvantage > 0 ? `Material advantage plus ${formatMaterialAdvantage(materialAdvantage)}` : "No material advantage";
  const handEntries = Object.entries(handCounts).filter(([, count]) => count > 0);
  const handTotal = handEntries.reduce((total, [, count]) => total + count, 0);
  const resolvedPieceSkin = resolvePieceSkin(variantKey, pieceSkin);
  const handLabel = variantKey === "crazyhouse" ? "Pocket" : "Hand";
  const selectedHandLabel = selectedHandCode ? getPieceDisplayName(selectedHandCode, variantKey, locale) : null;
  const vocabulary = getVocabulary(normalizeLocale(locale));
  const handStatus = selectedHandLabel && canUseHand ? `${vocabulary.actions.drop} ${selectedHandLabel}` : String(handTotal);
  const handTitle = selectedHandLabel && canUseHand ? `${vocabulary.actions.drop} ${selectedHandLabel} to a highlighted square.` : `${handLabel}: ${handTotal} ${handTotal === 1 ? "piece" : "pieces"} available.`;
  const showHandTray = supportsDrops || handEntries.length > 0;
  const displayName = isBot ? `${botLevelLabel} bot` : playerLabel ?? (isHuman ? "Guest player" : `${colorLabel(color)} player`);
  const avatarLabel = playerAvatarLabel ?? (isBot ? "AI" : isHuman ? "YOU" : colorLabel(color).slice(0, 2));

  return (
    <div className={`board-player-card board-player-card-${placement} ${isActive ? "is-active" : ""}`} aria-label={`${colorLabel(color)} player card`}>
      <div className="player-avatar" aria-hidden="true">{avatarLabel}</div>
      <div className="player-card-main">
        <div className="player-card-row">
          <strong>{displayName}</strong>
          <span aria-label={`${colorLabel(color)} clock`}>{clock ? formatClock(clock.remainingMs, { untimed: timeControl === "freestyle" }) : "--:--"}</span>
        </div>
        <p>{isBot ? `${botStrengthDisplay}${thinking ? " - thinking" : ""}` : `${colorLabel(color)} side`}</p>
      </div>
      <div className="player-piece-rail">
        {showHandTray ? (
          <div className="hand-tray" data-hand-state={selectedHandLabel && canUseHand ? "selected" : canUseHand ? "ready" : handTotal ? "held" : "empty"} data-skin={resolvedPieceSkin}>
            <span className="hand-tray-status" aria-label={`${colorLabel(color)} ${handLabel.toLowerCase()}: ${handStatus}`} title={handTitle}>
              <strong>{handLabel}</strong>
              <span>{handStatus}</span>
            </span>
            <div className={`hand-strip ${handEntries.length ? "" : "is-empty"}`} aria-label={`${colorLabel(color)} ${handLabel.toLowerCase()} ${handEntries.length ? "pieces" : "empty"}`} data-skin={resolvedPieceSkin}>
              <span className="sr-only">Tap or drag a piece in hand to a legal empty square. Drop restrictions are included on each piece.</span>
              {handEntries.length ? handEntries.map(([code, count]) => {
                const pieceLabel = getPieceDisplayName(code, variantKey, locale);
                const actionLabel = `${canUseHand ? vocabulary.actions.drop : "Held"} ${pieceLabel}, ${count} in hand`;
                const helpText = getHandPieceHelpText({ canUseHand, pieceLabel, pieceCode: code, variantKey });
                return (
                  <button
                    key={`${color}-${code}`}
                    type="button"
                    aria-label={actionLabel}
                    className={`hand-piece-button focus-ring ${selectedHandCode === code ? "is-selected" : ""}`}
                    data-hand-piece={code}
                    data-hand-state={selectedHandCode === code ? "selected" : canUseHand ? "ready" : "held"}
                    data-piece-label={pieceLabel}
                    data-piece-count={count}
                    data-skin={resolvedPieceSkin}
                    disabled={!canUseHand}
                    draggable={canUseHand}
                    title={helpText}
                    onClick={() => onHandPieceClick?.(code)}
                    onDragStart={(event) => {
                      if (!canUseHand) return;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(handPieceDragType, code);
                      setPieceDragImage(event);
                    }}
                  >
                    <PieceIcon code={code} owner={color as Piece["owner"]} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} />
                    <span aria-hidden="true">{count}</span>
                  </button>
                );
              }) : <span className="hand-empty-pill" aria-hidden="true" title={`${handLabel} is empty. Captured pieces will appear here.`}>0</span>}
            </div>
          </div>
        ) : null}
        <div className={`captured-strip ${capturedPieces.length ? "" : "is-empty"}`} aria-label={`${colorLabel(color)} captured pieces. ${materialLabel}`} data-material-advantage={materialAdvantage > 0 ? formatMaterialAdvantage(materialAdvantage) : undefined}>
          {visibleCaptures.length ? (
            <>
              {visibleCaptures.map((piece, index) => (
                <span key={`${piece.id}-${index}`} className="captured-piece" data-capture-index={index} data-captured-owner={piece.owner} style={{ zIndex: index + 1 }} title={`Captured ${getPieceDisplayName(piece.code, variantKey, locale, piece.promoted)}`}>
                  <PieceIcon code={piece.code} owner={piece.owner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} promoted={piece.promoted} />
                </span>
              ))}
              {hiddenCaptureCount > 0 ? <strong className="captured-overflow" aria-label={`${hiddenCaptureCount} more captured pieces`}>+{hiddenCaptureCount}</strong> : null}
              {materialAdvantage > 0 ? <strong className="captured-material" aria-label={materialLabel} title={materialLabel}>+{formatMaterialAdvantage(materialAdvantage)}</strong> : null}
            </>
          ) : (
            <span className="captured-empty">No captures</span>
          )}
        </div>
      </div>
    </div>
  );
}

function materialValue(pieces: Piece[]) {
  return pieces.reduce((total, piece) => total + pieceValue(piece), 0);
}

function pieceValue(piece: Piece) {
  if (piece.promoted && piece.code === "p") return 2;
  const values: Record<string, number> = {
    p: 1,
    s: 1,
    d: 1,
    w: 2,
    c: 2,
    a: 3,
    b: 3,
    e: 3,
    f: 3,
    g: 0,
    h: 3,
    k: 0,
    l: 5,
    m: 4,
    n: 3,
    q: 9,
    r: 5,
    t: 6,
    x: 2
  };
  return values[piece.code] ?? 1;
}

function formatMaterialAdvantage(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
