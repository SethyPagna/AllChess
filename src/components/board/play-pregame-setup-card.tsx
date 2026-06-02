import { Bot, Eye, Flag, Medal, PlayCircle, Timer, Users } from "lucide-react";

import { botDifficultyLevels, type BotDifficultyKey } from "@/lib/bot/config";
import type { CatalogModeSupport } from "@/lib/catalog";
import { getTimeControl, timeControls, type TimeControlKey } from "@/lib/game/time-controls";
import type { PlayMode } from "@/components/board/game-board-options";

type SeatChoice = "random" | "first" | "second";

type PlayPregameSetupCardProps = {
  botDifficulty: BotDifficultyKey;
  botLevelLabel: string;
  botStrengthDisplay: string;
  botStrengthLabel: string;
  botTargetElo: number;
  firstColorLabel: string;
  isBotMode: boolean;
  onBotDifficultyChange: (difficulty: BotDifficultyKey) => void;
  onModeChange: (mode: PlayMode) => void;
  onSeatChoiceChange: (choice: SeatChoice) => void;
  onStartGame: () => void;
  onTimeControlChange: (timeControl: TimeControlKey) => void;
  playMode: PlayMode;
  modeSupport: Record<PlayMode, CatalogModeSupport>;
  seatChoice: SeatChoice;
  secondColorLabel: string;
  timeControl: TimeControlKey;
};

export function PlayPregameSetupCard({
  botDifficulty,
  botLevelLabel,
  botStrengthDisplay,
  botStrengthLabel,
  botTargetElo,
  firstColorLabel,
  isBotMode,
  onBotDifficultyChange,
  onModeChange,
  onSeatChoiceChange,
  onStartGame,
  onTimeControlChange,
  playMode,
  modeSupport,
  seatChoice,
  secondColorLabel,
  timeControl
}: PlayPregameSetupCardProps) {
  const timeControlLabel = getTimeControl(timeControl).label;
  const secondaryModes = [
    { key: "online" as const, label: "Play Online", Icon: Flag },
    { key: "room" as const, label: "Play a Friend", Icon: Users },
    { key: "spectate" as const, label: "Watch Games", Icon: Eye },
    { key: "offline" as const, label: "Offline Local", Icon: Medal }
  ];
  const modeAccessibleNames: Partial<Record<PlayMode, string>> = {
    room: "Create Room",
    spectate: "Spectate"
  };

  return (
    <div className="play-options-card play-setup-stack">
      <label className="play-setup-select-card">
        <Timer size={18} />
        <select aria-label="Time control" value={timeControl} onChange={(event) => onTimeControlChange(event.target.value as TimeControlKey)}>
          {timeControls.slice(0, 6).map((control) => (
            <option key={control.key} value={control.key}>
              {control.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onStartGame} className="focus-ring action-primary play-start-button">
        <PlayCircle size={18} />
        Start Game
      </button>
      <div className="play-time-grid play-time-grid-compact" aria-hidden="true">
        <span className="is-selected">{timeControlLabel}</span>
      </div>
      <div className="play-mode-stack" aria-label="Play modes">
        <button
          type="button"
          onClick={() => onModeChange("bot")}
          className={`focus-ring play-mode-stack-button ${playMode === "bot" ? "is-selected" : ""}`}
          disabled={!modeSupport.bot.enabled}
          title={modeSupport.bot.reason}
        >
          <Bot size={18} />
          <span>Bot Mode</span>
        </button>
        {secondaryModes.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            aria-label={modeAccessibleNames[key] ?? label}
            onClick={() => onModeChange(key)}
            className={`focus-ring play-mode-stack-button ${playMode === key ? "is-selected" : ""}`}
            disabled={!modeSupport[key].enabled}
            title={modeSupport[key].reason}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <label className={`bot-profile-card bot-profile-card-with-select play-setup-bot-card ${!isBotMode ? "is-disabled" : ""}`} title={isBotMode ? "Choose how strong the bot should be." : "Bot difficulty is only used in Bot Mode."}>
        <Bot size={18} />
        <div>
          <strong>{isBotMode ? `${botLevelLabel} bot` : "Bot setup"}</strong>
          <span title={botStrengthLabel}>{isBotMode ? `${botStrengthDisplay} - ${botStrengthLabel}` : "Switch to Bot Mode to choose tier."}</span>
        </div>
        <small title={botStrengthLabel}>target {botTargetElo}</small>
        <select aria-label="Bot difficulty" value={botDifficulty} onChange={(event) => onBotDifficultyChange(event.target.value as BotDifficultyKey)} disabled={!isBotMode}>
          {botDifficultyLevels.map((level) => (
            <option key={level.key} value={level.key}>
              {level.label}
            </option>
          ))}
        </select>
      </label>
      <label className="play-setup-field">
        <span>Side</span>
        <select aria-label="Side" value={seatChoice} onChange={(event) => onSeatChoiceChange(event.target.value as SeatChoice)}>
          <option value="random">Random side</option>
          <option value="first">{firstColorLabel}</option>
          <option value="second">{secondColorLabel}</option>
        </select>
      </label>
    </div>
  );
}
