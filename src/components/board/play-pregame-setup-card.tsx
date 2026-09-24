import { Bot, Eye, Flag, MonitorSmartphone, PlayCircle, Users } from "lucide-react";

import { botDifficultyLevels, type BotDifficultyKey } from "@/lib/bot/config";
import type { CatalogModeSupport } from "@/lib/catalog";
import { timeControls, type TimeControlKey } from "@/lib/game/time-controls";
import type { PlayMode } from "@/components/board/game-board-options";

import { ChoiceButtons, ChoicePicker } from "./choice-buttons";

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
  joiningRoom?: boolean;
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
  timeControl,
  joiningRoom = false
}: PlayPregameSetupCardProps) {
  const secondaryModes = [
    { key: "online" as const, label: "Quick Match", Icon: Flag },
    { key: "room" as const, label: "Play a Friend", Icon: Users },
    { key: "spectate" as const, label: "Watch Games", Icon: Eye },
    { key: "offline" as const, label: "Offline Local", Icon: MonitorSmartphone }
  ];
  const modeAccessibleNames: Partial<Record<PlayMode, string>> = {
    spectate: "Spectate"
  };
  const startActionLabel = joiningRoom && playMode === "room" ? "Join game" : startLabelForMode(playMode);

  return (
    <div className="play-options-card play-setup-stack">
      <ChoiceButtons label="Time control" value={timeControl} onChange={onTimeControlChange} options={timeControls.slice(0, 6).map(control => ({ key: control.key, label: control.key === "freestyle" ? "Untimed" : control.label }))} />
      <div className="play-mode-stack" aria-label="Play modes">
        <button
          type="button"
          aria-pressed={playMode === "bot"}
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
            aria-pressed={playMode === key}
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
      {isBotMode ? (
        <div className="choice-field" title={`${botLevelLabel} · ${botStrengthLabel} · target ${botTargetElo}`}>
          <ChoicePicker label="Bot difficulty" value={botDifficulty} onChange={onBotDifficultyChange} options={botDifficultyLevels.map(level => ({ key: level.key, label: level.label }))} />
          <small className="choice-help">{botStrengthDisplay}</small>
        </div>
      ) : null}
      <ChoiceButtons label="Side" value={seatChoice} onChange={onSeatChoiceChange} options={[{ key: "random", label: "Random" }, { key: "first", label: firstColorLabel }, { key: "second", label: secondColorLabel }]} />
      <button type="button" onClick={onStartGame} className="focus-ring action-primary play-start-button">
        <PlayCircle size={18} />
        {startActionLabel}
      </button>
    </div>
  );
}

function startLabelForMode(playMode: PlayMode) {
  if (playMode === "online") return "Find Match";
  if (playMode === "room") return "Create Room";
  if (playMode === "spectate") return "Start Watching";
  return "Start Game";
}
