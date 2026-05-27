import { PlayCircle, SlidersHorizontal, Timer } from "lucide-react";

import { botDifficultyLevels, type BotDifficultyKey } from "@/lib/bot/config";
import { getTimeControl, timeControls, type TimeControlKey } from "@/lib/game/time-controls";
import { playModeOptions, type PlayMode } from "@/components/board/game-board-options";

type SeatChoice = "random" | "first" | "second";

type PlayPregameSetupCardProps = {
  botDifficulty: BotDifficultyKey;
  firstColorLabel: string;
  humanColorLabel: string;
  isBotMode: boolean;
  onBotDifficultyChange: (difficulty: BotDifficultyKey) => void;
  onModeChange: (mode: PlayMode) => void;
  onSeatChoiceChange: (choice: SeatChoice) => void;
  onStartGame: () => void;
  onTimeControlChange: (timeControl: TimeControlKey) => void;
  playMode: PlayMode;
  seatChoice: SeatChoice;
  secondColorLabel: string;
  timeControl: TimeControlKey;
};

export function PlayPregameSetupCard({
  botDifficulty,
  firstColorLabel,
  humanColorLabel,
  isBotMode,
  onBotDifficultyChange,
  onModeChange,
  onSeatChoiceChange,
  onStartGame,
  onTimeControlChange,
  playMode,
  seatChoice,
  secondColorLabel,
  timeControl
}: PlayPregameSetupCardProps) {
  return (
    <div className="play-options-card">
      <div className="play-mode-grid" aria-label="Play modes">
        {playModeOptions.map(({ key, label, description, Icon }) => (
          <button key={key} type="button" onClick={() => onModeChange(key)} className={`focus-ring play-mode-button ${playMode === key ? "is-selected" : ""}`}>
            <Icon size={17} />
            <span>{label}</span>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <div className="play-options-heading">
        <Timer size={18} />
        <span>{getTimeControl(timeControl).label}</span>
      </div>
      <label className="play-setup-field">
        <span>Side</span>
        <select aria-label="Side" value={seatChoice} onChange={(event) => onSeatChoiceChange(event.target.value as SeatChoice)}>
          <option value="random">Random side</option>
          <option value="first">{firstColorLabel}</option>
          <option value="second">{secondColorLabel}</option>
        </select>
      </label>
      <label className={`play-setup-field ${!isBotMode ? "is-disabled" : ""}`} title={isBotMode ? "Choose how strong the bot should be." : "Bot difficulty is only used in Bot Mode."}>
        <span>Bot difficulty</span>
        <select aria-label="Bot difficulty" value={botDifficulty} onChange={(event) => onBotDifficultyChange(event.target.value as BotDifficultyKey)} disabled={!isBotMode}>
          {botDifficultyLevels.map((level) => (
            <option key={level.key} value={level.key}>
              {level.label}
            </option>
          ))}
        </select>
      </label>
      <div className="play-time-grid" aria-label="Quick time controls">
        {timeControls.slice(0, 6).map((control) => (
          <button key={control.key} type="button" title={`Start a new ${control.label} game`} onClick={() => onTimeControlChange(control.key)} className={`focus-ring ${timeControl === control.key ? "is-selected" : ""}`}>
            {control.label}
          </button>
        ))}
      </div>
      <div className="play-options-row">
        <SlidersHorizontal size={18} />
        <span>Side</span>
        <strong>{humanColorLabel}</strong>
      </div>
      <button type="button" onClick={onStartGame} className="focus-ring action-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
        <PlayCircle size={18} />
        Start Game
      </button>
      <p className="text-xs font-bold text-[var(--muted)]">Choose mode, side, clock, and bot tier first. During play, Status keeps the live controls compact.</p>
    </div>
  );
}
