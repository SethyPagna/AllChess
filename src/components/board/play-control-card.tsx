import { Bot, Flag, FlipHorizontal2, Handshake, Lightbulb, PauseCircle, PlayCircle, Redo2, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";

import type { PieceSkinOption, PieceSkinPreference } from "@/components/board/piece-icon";

type BotMode = "human" | "opponent" | "both";

type PlayControlCardProps = {
  botLevelLabel: string;
  botMode: BotMode;
  canEndGame: boolean;
  canRedo: boolean;
  canUndo: boolean;
  canUseAssist: boolean;
  canUseBots: boolean;
  gameStarted: boolean;
  isThinking: boolean;
  onApplySuggestion: () => void;
  onCancelThinking: () => void;
  onFlipBoard: () => void;
  onMoveForCurrentSide: () => void;
  onOfferDraw: () => void;
  onPieceSkinChange: (pieceSkin: PieceSkinPreference) => void;
  onRedo: () => void;
  onResign: () => void;
  onReset: () => void;
  onSuggest: () => void;
  onToggleAuto: () => void;
  onToggleBot: () => void;
  onUndo: () => void;
  pieceSkin: PieceSkinPreference;
  pieceSkinOptions: PieceSkinOption[];
  suggestedMoveReady: boolean;
};

export function PlayControlCard({
  botLevelLabel,
  botMode,
  canEndGame,
  canRedo,
  canUndo,
  canUseAssist,
  canUseBots,
  gameStarted,
  isThinking,
  onApplySuggestion,
  onCancelThinking,
  onFlipBoard,
  onMoveForCurrentSide,
  onOfferDraw,
  onPieceSkinChange,
  onRedo,
  onResign,
  onReset,
  onSuggest,
  onToggleAuto,
  onToggleBot,
  onUndo,
  pieceSkin,
  pieceSkinOptions,
  suggestedMoveReady
}: PlayControlCardProps) {
  return (
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
          </div>
          <div className="play-control-group play-control-group-primary">
            <button
              type="button"
              aria-label="Suggest"
              title={suggestedMoveReady ? "Play the highlighted suggestion." : canUseAssist ? "Find and highlight a legal candidate move for the current side." : "Suggestions are disabled for online, room, spectate, review, completed, or not-started states."}
              onClick={suggestedMoveReady ? onApplySuggestion : onSuggest}
              className={`focus-ring ${suggestedMoveReady ? "action-primary is-main" : "action-secondary"} play-control-button`}
              disabled={!canUseAssist}
            >
              <Lightbulb size={15} />
              <span>Suggest</span>
            </button>
            <button type="button" aria-label="Move" title={canUseAssist ? "Ask the bot engine to move for whichever side is currently to move." : "Move for me is disabled for online, room, spectate, review, completed, or not-started states."} onClick={onMoveForCurrentSide} className="focus-ring action-secondary play-control-button" disabled={!canUseAssist}>
              <PlayCircle size={15} />
              <span>Move</span>
            </button>
            <button type="button" title="Flip the visual board orientation without changing sides." onClick={onFlipBoard} className="focus-ring action-secondary play-icon-button" aria-label="Flip board">
              <FlipHorizontal2 size={15} />
            </button>
            <button type="button" title={isThinking ? "Pause the current bot search." : "Pause is available only while the bot is thinking."} onClick={onCancelThinking} className="focus-ring action-secondary play-icon-button" disabled={!isThinking} aria-label="Pause thinking">
              <PauseCircle size={15} />
            </button>
            <button type="button" title={canUndo ? "Undo the last local move." : "Undo is disabled for online, room, spectate, review, thinking, or empty history states."} onClick={onUndo} className="focus-ring action-secondary play-icon-button" aria-label="Undo" disabled={!canUndo}>
              <Undo2 size={15} />
            </button>
            <button type="button" title={canRedo ? "Redo the next local move from history." : "Redo is disabled for online, room, spectate, review, thinking, or empty future states."} onClick={onRedo} className="focus-ring action-secondary play-icon-button" aria-label="Redo" disabled={!canRedo}>
              <Redo2 size={15} />
            </button>
            <button type="button" title="Reset the game with the current setup." onClick={onReset} className="focus-ring action-secondary play-icon-button" aria-label="Reset">
              <RotateCcw size={15} />
            </button>
          </div>
        </section>
        <section className="play-control-section" aria-label="Piece appearance">
          <div className="play-control-group-label">
            <span>Look</span>
            <small>Piece skin</small>
          </div>
          <div className="play-skin-rail" role="radiogroup" aria-label="Piece skin">
            {pieceSkinOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={pieceSkin === option.key}
                title={`Use ${option.label} piece skin`}
                onClick={() => onPieceSkinChange(option.key)}
                className={`focus-ring play-skin-chip ${pieceSkin === option.key ? "is-selected" : ""}`}
                data-skin-option={option.key}
              >
                <span className="play-skin-swatch" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            Selected piece skin: {pieceSkinOptions.find((option) => option.key === pieceSkin)?.label ?? "Auto"}
          </span>
        </section>
        <section className="play-control-section" aria-label="Match controls">
          <div className="play-control-group-label">
            <span>Match</span>
            <small>{canUseBots ? botLevelLabel : canEndGame ? "Live" : "Start"}</small>
          </div>
          <div className="play-control-group play-control-group-match">
            <button type="button" aria-label="Bot Mode" title={canUseBots ? "Toggle bot opponent. You move your selected side; the bot replies for the other side." : "Bot opponent is only available in Bot Mode during an active local game."} onClick={onToggleBot} disabled={!canUseBots} className={`focus-ring action-secondary play-control-button ${botMode === "opponent" ? "is-selected" : ""}`}>
              <Bot size={15} />
              <span>Bot</span>
            </button>
            <button type="button" aria-label="Auto" title={canUseBots ? "Let bots control both sides until you turn this off." : "Auto is only available in Bot Mode during an active local game."} onClick={onToggleAuto} disabled={!canUseBots} className={`focus-ring action-secondary play-control-button ${botMode === "both" ? "is-selected" : ""}`}>
              <Bot size={15} />
              <span>Auto</span>
            </button>
            <button type="button" aria-label="Draw" onClick={onOfferDraw} disabled={!canEndGame} className="focus-ring action-secondary play-control-button" title={canEndGame ? "End this local game as a draw." : "Draw is unavailable until an active playable game starts."}>
              <Handshake size={15} />
              <span>Draw</span>
            </button>
            <button type="button" aria-label="Resign" onClick={onResign} disabled={!canEndGame} className="focus-ring play-control-button is-danger" title={canEndGame ? "Resign the active game." : "Resign is unavailable until an active game starts."}>
              <Flag size={15} />
              <span>Resign</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
