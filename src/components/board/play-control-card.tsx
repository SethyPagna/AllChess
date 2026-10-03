"use client";

import { useRef, type ReactNode } from "react";
import { Bot, Download, Flag, Handshake, Lightbulb, MoreHorizontal, Pause, Play, PlayCircle, Redo2, RotateCcw, SkipForward, Square, Undo2, Users } from "lucide-react";

import { closeDetails, useDismissableDetails } from "@/components/ui/use-dismissable-details";

type BotMode = "human" | "opponent" | "both";

type PlayControlCardProps = {
  botMode: BotMode;
  canEndGame: boolean;
  canRedo: boolean;
  canUndo: boolean;
  canUseAssist: boolean;
  canUseBots: boolean;
  canPass?: boolean;
  isThinking: boolean;
  paused?: boolean;
  suggestedMoveReady: boolean;
  onApplySuggestion: () => void;
  onCancelThinking: () => void;
  onExport?: () => void;
  onMoveForCurrentSide: () => void;
  onOfferDraw: () => void;
  onPass?: () => void;
  onRedo: () => void;
  onResign: () => void;
  onReset: () => void;
  onSuggest: () => void;
  onToggleAuto: () => void;
  onToggleBot: () => void;
  onTogglePause?: () => void;
  onUndo: () => void;
};

export function PlayControlCard({
  botMode,
  canEndGame,
  canRedo,
  canUndo,
  canUseAssist,
  canUseBots,
  canPass = false,
  isThinking,
  paused = false,
  suggestedMoveReady,
  onApplySuggestion,
  onCancelThinking,
  onExport,
  onMoveForCurrentSide,
  onOfferDraw,
  onPass,
  onRedo,
  onResign,
  onReset,
  onSuggest,
  onToggleAuto,
  onToggleBot,
  onTogglePause,
  onUndo
}: PlayControlCardProps) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(moreRef);
  function closeMenu() {
    closeDetails(moreRef, { restoreFocus: true });
  }
  const menuItem = (label: string, icon: ReactNode, onClick: () => void, options: { disabled?: boolean; pressed?: boolean } = {}) => (
    <button
      type="button"
      className="focus-ring play-menu-item"
      aria-pressed={options.pressed}
      disabled={options.disabled}
      onClick={() => { onClick(); closeMenu(); }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="play-actions" aria-label="Board controls">
      {isThinking ? (
        <button type="button" className="focus-ring play-action" onClick={onCancelThinking} aria-label="Stop bot thinking" title="Stop the bot's current search">
          <Square size={17} />
          <span>Stop</span>
        </button>
      ) : (
        <button type="button" className="focus-ring play-action" onClick={onUndo} disabled={!canUndo} title="Take back the last move">
          <Undo2 size={17} />
          <span>Undo</span>
        </button>
      )}
      <button
        type="button"
        className={`focus-ring play-action${suggestedMoveReady ? " is-primary" : ""}`}
        onClick={suggestedMoveReady ? onApplySuggestion : onSuggest}
        disabled={!canUseAssist}
        aria-label={suggestedMoveReady ? "Play suggested move" : "Suggest a move"}
        title={suggestedMoveReady ? "Play the highlighted move" : "Highlight a good move"}
      >
        {suggestedMoveReady ? <PlayCircle size={17} /> : <Lightbulb size={17} />}
        <span>{suggestedMoveReady ? "Play" : "Suggest"}</span>
      </button>
      {onPass ? (
        <button type="button" className="focus-ring play-action" onClick={onPass} disabled={!canPass} aria-label="Pass turn" title="Pass this turn when not in check">
          <SkipForward size={17} />
          <span>Pass</span>
        </button>
      ) : (
        <button type="button" className="focus-ring play-action" onClick={onOfferDraw} disabled={!canEndGame} title="End the game as a draw">
          <Handshake size={17} />
          <span>Draw</span>
        </button>
      )}
      <button type="button" className="focus-ring play-action is-danger" onClick={onResign} disabled={!canEndGame} title="Resign this game">
        <Flag size={17} />
        <span>Resign</span>
      </button>
      <details ref={moreRef} className="play-more">
        <summary className="focus-ring play-action" aria-label="More game actions" title="More">
          <MoreHorizontal size={17} />
          <span>More</span>
        </summary>
        <div className="play-more-menu popover">
          {onPass ? menuItem("Draw", <Handshake size={15} />, onOfferDraw, { disabled: !canEndGame }) : null}
          {menuItem("Redo", <Redo2 size={15} />, onRedo, { disabled: !canRedo })}
          {menuItem("Move for me", <PlayCircle size={15} />, onMoveForCurrentSide, { disabled: !canUseAssist })}
          {canUseBots || botMode !== "human" ? (
            <>
              {menuItem("Bot opponent", <Bot size={15} />, onToggleBot, { disabled: !canUseBots && botMode !== "opponent", pressed: botMode === "opponent" })}
              {menuItem("Auto · bots play both sides", <Users size={15} />, onToggleAuto, { disabled: !canUseBots && botMode !== "both", pressed: botMode === "both" })}
            </>
          ) : null}
          {onTogglePause ? menuItem(paused ? "Resume game" : "Pause game", paused ? <Play size={15} /> : <Pause size={15} />, onTogglePause) : null}
          {onExport ? menuItem("Export game", <Download size={15} />, onExport) : null}
          <hr />
          {menuItem("New game", <RotateCcw size={15} />, onReset)}
        </div>
      </details>
    </div>
  );
}
