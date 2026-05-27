import { PieceIcon } from "@/components/board/piece-icon";
import { colorLabel } from "@/components/board/game-board-utils";
import { formatClock } from "@/lib/game/clocks";
import type { Piece, PlayerClock } from "@/lib/variants";

type BoardPlayerCardProps = {
  botCalibrationLabel: string;
  botLevelLabel: string;
  botModeActive: boolean;
  botStrengthDisplay: string;
  capturedPieces: Piece[];
  clock?: PlayerClock;
  color: string;
  humanColor: string;
  isActive: boolean;
  placement: "top" | "bottom";
  thinking: boolean;
  timeControl: string;
  variantKey: string;
};

export function BoardPlayerCard({
  botCalibrationLabel,
  botLevelLabel,
  botModeActive,
  botStrengthDisplay,
  capturedPieces,
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

  return (
    <div className={`board-player-card board-player-card-${placement} ${isActive ? "is-active" : ""}`} aria-label={`${colorLabel(color)} player card`}>
      <div className="player-avatar" aria-hidden="true">{isBot ? "AI" : isHuman ? "You" : colorLabel(color).slice(0, 2)}</div>
      <div className="player-card-main">
        <div className="player-card-row">
          <strong>{isHuman ? "Your profile" : isBot ? `${botLevelLabel} bot` : `${colorLabel(color)} player`}</strong>
          <span aria-label={`${colorLabel(color)} clock`}>{clock ? formatClock(clock.remainingMs, { untimed: timeControl === "freestyle" }) : "--:--"}</span>
        </div>
        <p>{isBot ? `${botStrengthDisplay} - ${botCalibrationLabel} - ${thinking ? "thinking" : "ready"}` : isHuman ? `${colorLabel(color)} side - local profile` : `${colorLabel(color)} side`}</p>
      </div>
      <div className="captured-strip" aria-label={`${colorLabel(color)} captured pieces`}>
        {capturedPieces.length ? (
          capturedPieces.slice(0, 12).map((piece, index) => (
            <span key={`${piece.id}-${index}`} className="captured-piece">
              <PieceIcon code={piece.code} owner={piece.owner} variantKey={variantKey} promoted={piece.promoted} />
            </span>
          ))
        ) : (
          <span className="captured-empty">No captures</span>
        )}
      </div>
    </div>
  );
}
