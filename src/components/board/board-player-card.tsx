import { PieceIcon } from "@/components/board/piece-icon";
import { colorLabel } from "@/components/board/game-board-utils";
import { formatClock } from "@/lib/game/clocks";
import type { Piece, PlayerClock } from "@/lib/variants";

type BoardPlayerCardProps = {
  botLevelLabel: string;
  botModeActive: boolean;
  botStrengthDisplay: string;
  capturedPieces: Piece[];
  opponentCapturedPieces: Piece[];
  clock?: PlayerClock;
  color: string;
  humanColor: string;
  isActive: boolean;
  placement: "top" | "bottom";
  thinking: boolean;
  timeControl: string;
  variantKey: string;
};

const visibleCaptureLimit = 14;

export function BoardPlayerCard({
  botLevelLabel,
  botModeActive,
  botStrengthDisplay,
  capturedPieces,
  opponentCapturedPieces,
  clock,
  color,
  humanColor,
  isActive,
  placement,
  thinking,
  timeControl,
  variantKey
}: BoardPlayerCardProps) {
  const isHuman = color === humanColor;
  const isBot = botModeActive;
  const materialAdvantage = Math.max(0, materialValue(capturedPieces) - materialValue(opponentCapturedPieces));
  const visibleCaptures = capturedPieces.slice(0, visibleCaptureLimit);
  const hiddenCaptureCount = Math.max(0, capturedPieces.length - visibleCaptures.length);

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
      <div className={`captured-strip ${capturedPieces.length ? "" : "is-empty"}`} aria-label={`${colorLabel(color)} captured pieces`}>
        {visibleCaptures.length ? (
          <>
            {visibleCaptures.map((piece, index) => (
              <span key={`${piece.id}-${index}`} className="captured-piece">
                <PieceIcon code={piece.code} owner={piece.owner} variantKey={variantKey} promoted={piece.promoted} />
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
