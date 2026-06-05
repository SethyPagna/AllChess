import { PieceIcon, getPieceDisplayName, getPieceSkin } from "@/components/board/piece-icon";
import { colorLabel } from "@/components/board/game-board-utils";
import { formatClock } from "@/lib/game/clocks";
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
  placement: "top" | "bottom";
  selectedHandCode?: string | null;
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
  placement,
  selectedHandCode = null,
  thinking,
  timeControl,
  variantKey
}: BoardPlayerCardProps) {
  const isHuman = color === humanColor;
  const isBot = botModeActive;
  const materialAdvantage = Math.max(0, materialValue(capturedPieces) - materialValue(opponentCapturedPieces));
  const visibleCaptures = capturedPieces.slice(0, visibleCaptureLimit);
  const hiddenCaptureCount = Math.max(0, capturedPieces.length - visibleCaptures.length);
  const handEntries = Object.entries(handCounts).filter(([, count]) => count > 0);
  const pieceSkin = getPieceSkin(variantKey);

  return (
    <div className={`board-player-card board-player-card-${placement} ${isActive ? "is-active" : ""}`} aria-label={`${colorLabel(color)} player card`}>
      <div className="player-avatar" aria-hidden="true">{isBot ? "AI" : isHuman ? "You" : colorLabel(color).slice(0, 2)}</div>
      <div className="player-card-main">
        <div className="player-card-row">
          <strong>{isHuman ? "Your profile" : isBot ? `${botLevelLabel} bot` : `${colorLabel(color)} player`}</strong>
          <span aria-label={`${colorLabel(color)} clock`}>{clock ? formatClock(clock.remainingMs, { untimed: timeControl === "freestyle" }) : "--:--"}</span>
        </div>
        <p>{isBot ? `${botStrengthDisplay}${thinking ? " - thinking" : ""}` : `${colorLabel(color)} side`}</p>
      </div>
      <div className="player-piece-rail">
        {handEntries.length ? (
          <div className="hand-strip" aria-label={`${colorLabel(color)} pieces in hand`} data-skin={pieceSkin}>
            <span className="sr-only">Tap or drag a piece in hand to a legal empty square.</span>
            {handEntries.map(([code, count]) => {
              const pieceLabel = getPieceDisplayName(code, variantKey, locale);
              const actionLabel = `${canUseHand ? "Drop" : "Held"} ${pieceLabel}, ${count} in hand`;
              const helpText = canUseHand ? `Tap or drag ${pieceLabel} to a legal empty square.` : `${pieceLabel} is in hand. Start or resume your turn to drop it.`;
              return (
                <button
                  key={`${color}-${code}`}
                  type="button"
                  aria-label={actionLabel}
                  className={`hand-piece-button focus-ring ${selectedHandCode === code ? "is-selected" : ""}`}
                  data-hand-piece={code}
                  data-skin={pieceSkin}
                  disabled={!canUseHand}
                  draggable={canUseHand}
                  title={helpText}
                  onClick={() => onHandPieceClick?.(code)}
                  onDragStart={(event) => {
                    if (!canUseHand) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(handPieceDragType, code);
                  }}
                >
                  <PieceIcon code={code} owner={color as Piece["owner"]} variantKey={variantKey} locale={locale} />
                  <span aria-hidden="true">{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className={`captured-strip ${capturedPieces.length ? "" : "is-empty"}`} aria-label={`${colorLabel(color)} captured pieces`}>
          {visibleCaptures.length ? (
            <>
              {visibleCaptures.map((piece, index) => (
                <span key={`${piece.id}-${index}`} className="captured-piece">
                  <PieceIcon code={piece.code} owner={piece.owner} variantKey={variantKey} locale={locale} promoted={piece.promoted} />
                </span>
              ))}
              {hiddenCaptureCount > 0 ? <strong className="captured-overflow" aria-label={`${hiddenCaptureCount} more captured pieces`}>+{hiddenCaptureCount}</strong> : null}
              {materialAdvantage > 0 ? <strong className="captured-material">+{formatMaterialAdvantage(materialAdvantage)}</strong> : null}
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
