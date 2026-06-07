import { Bot, Flag, FlipHorizontal2, Handshake, Lightbulb, PauseCircle, PlayCircle, Redo2, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";

import type { PieceSkinOption, PieceSkinPreference } from "@/components/board/piece-icon";

type BotMode = "human" | "opponent" | "both";

export type BoardThemePreference = "classic" | "wood" | "jade" | "ocean" | "contrast";

export type BoardThemeOption = {
  key: BoardThemePreference;
  label: string;
};

type PlayControlCardProps = {
  botLevelLabel: string;
  botMode: BotMode;
  boardTheme: BoardThemePreference;
  boardThemeOptions: BoardThemeOption[];
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
  onBoardThemeChange: (theme: BoardThemePreference) => void;
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
  boardTheme,
  boardThemeOptions,
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
  onBoardThemeChange,
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
        <section className="play-control-section" aria-label="Board appearance">
          <details className="play-look-disclosure">
            <summary className="focus-ring">
              <span>Look</span>
              <small>{boardThemeOptions.find((option) => option.key === boardTheme)?.label ?? "Board"} / {pieceSkinOptions.find((option) => option.key === pieceSkin)?.label ?? "Pieces"}</small>
            </summary>
            <div className="play-look-grid">
              <label>
                <span>Board</span>
                <select className="focus-ring" aria-label="Board theme" value={boardTheme} onChange={(event) => onBoardThemeChange(event.target.value as BoardThemePreference)}>
                  {boardThemeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="play-look-option-row" role="group" aria-label="Board theme options">
                {boardThemeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className="focus-ring play-look-option"
                    aria-label={`Use ${option.label} board`}
                    aria-pressed={boardTheme === option.key}
                    data-board-theme-option={option.key}
                    data-selected={boardTheme === option.key ? "true" : undefined}
                    onClick={() => onBoardThemeChange(option.key)}
                    title={option.label}
                  >
                    <span aria-hidden="true" />
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
              <label>
                <span>Pieces</span>
                <select className="focus-ring" aria-label="Piece skin" value={pieceSkin} onChange={(event) => onPieceSkinChange(event.target.value as PieceSkinPreference)}>
                  {pieceSkinOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="play-look-option-row play-look-piece-row" role="group" aria-label="Piece style choices">
                {pieceSkinOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className="focus-ring play-look-option"
                    aria-label={`Use ${option.label} pieces`}
                    aria-pressed={pieceSkin === option.key}
                    data-piece-skin-option={option.key}
                    data-selected={pieceSkin === option.key ? "true" : undefined}
                    onClick={() => onPieceSkinChange(option.key)}
                    title={option.label}
                  >
                    <span aria-hidden="true" />
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          </details>
          <span className="sr-only" aria-live="polite">
            Selected appearance: {boardThemeOptions.find((option) => option.key === boardTheme)?.label ?? "Board"} board, {pieceSkinOptions.find((option) => option.key === pieceSkin)?.label ?? "Auto"} pieces
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
