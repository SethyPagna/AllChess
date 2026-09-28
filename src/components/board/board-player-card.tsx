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

/** One line per player: side dot, name and clock; held pieces sit on the same line only when there are any. */
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
  playerLabel,
  placement,
  selectedHandCode = null,
  supportsDrops = false,
  thinking,
  timeControl,
  variantKey
}: BoardPlayerCardProps) {
  const isBot = botModeActive;
  const materialAdvantage = Math.max(0, materialValue(capturedPieces) - materialValue(opponentCapturedPieces));
  const visibleCaptures = capturedPieces.slice(0, visibleCaptureLimit);
  const hiddenCaptureCount = Math.max(0, capturedPieces.length - visibleCaptures.length);
  const materialLabel = materialAdvantage > 0 ? `Material advantage plus ${formatMaterialAdvantage(materialAdvantage)}` : "No material advantage";
  const handEntries = Object.entries(handCounts).filter(([, count]) => count > 0);
  const handTotal = handEntries.reduce((total, [, count]) => total + count, 0);
  const resolvedPieceSkin = resolvePieceSkin(variantKey, pieceSkin);
  const handLabel = variantKey === "crazyhouse" ? "Pocket" : "Hand";
  const vocabulary = getVocabulary(normalizeLocale(locale));
  const showHandTray = supportsDrops || handEntries.length > 0;
  const side = colorLabel(color);
  const displayName = isBot ? `${botLevelLabel} bot` : playerLabel ?? (color === humanColor ? "You" : side);

  return (
    <div className={`board-player-card board-player-card-${placement} ${isActive ? "is-active" : ""}`} aria-label={`${side} player card`}>
      <span className="player-dot" data-color={color} aria-hidden="true" />
      <div className="player-card-main">
        <div className="player-card-row">
          <strong title={isBot ? botStrengthDisplay : undefined}>{displayName}</strong>
          {isBot && thinking ? <small className="player-status">thinking…</small> : null}
          <span aria-label={`${side} clock`}>{clock ? formatClock(clock.remainingMs, { untimed: timeControl === "freestyle" }) : "--:--"}</span>
        </div>
      </div>
      <div className="player-piece-rail">
        {showHandTray ? (
          <div className={`hand-tray${handEntries.length ? "" : " sr-only"}`} data-hand-state={selectedHandCode && canUseHand ? "selected" : canUseHand ? "ready" : handTotal ? "held" : "empty"} data-skin={resolvedPieceSkin}>
            <div className={`hand-strip ${handEntries.length ? "" : "is-empty"}`} role="group" aria-label={`${side} ${handLabel.toLowerCase()} ${handEntries.length ? "pieces" : "empty"}`} data-skin={resolvedPieceSkin}>
              {handEntries.length ? <span className="sr-only">Tap or drag a piece in hand to a legal empty square. Drop restrictions are included on each piece.</span> : null}
              {handEntries.map(([code, count]) => {
                const pieceLabel = getPieceDisplayName(code, variantKey, locale);
                const actionLabel = `${canUseHand ? vocabulary.actions.drop : "Held"} ${pieceLabel}, ${count} in hand`;
                const helpText = getHandPieceHelpText({ canUseHand, pieceLabel, pieceCode: code, variantKey });
                return (
                  <button
                    key={`${color}-${code}`}
                    type="button"
                    aria-label={actionLabel}
                    aria-pressed={canUseHand ? selectedHandCode === code : undefined}
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
              })}
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
