import type { ReactNode } from "react";

import { botDifficultyLevels, type BotDifficultyKey } from "@/lib/bot/config";
import type { CatalogModeSupport } from "@/lib/catalog";
import { timeControls, type TimeControlKey } from "@/lib/game/time-controls";
import type { PlayMode } from "@/components/board/game-board-options";

import { ChoicePicker } from "./choice-buttons";

type SeatChoice = "random" | "first" | "second";

type PlayPregameSetupCardProps = {
  gameSetup?: ReactNode;
  botDifficulty: BotDifficultyKey;
  botLevelLabel: string;
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

// Watching is reached from Watch, a spectator link or ?mode=spectate; it is not a way to play, so it has no segment here.
const modes = [
  { key: "bot" as const, label: "Bot Mode", shortLabel: "Bot" },
  { key: "online" as const, label: "Quick Match", shortLabel: "Match" },
  { key: "room" as const, label: "Play a Friend", shortLabel: "Friend" },
  { key: "offline" as const, label: "Offline Local", shortLabel: "Local" }
];

export function PlayPregameSetupCard({
  botDifficulty,
  botLevelLabel,
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
  gameSetup,
  joiningRoom = false
}: PlayPregameSetupCardProps) {
  const startActionLabel = joiningRoom && playMode === "room" ? "Join game" : startLabelForMode(playMode);
  const showSide = playMode !== "online" && playMode !== "spectate";
  const sides = [{ key: "random" as const, label: "Random" }, { key: "first" as const, label: firstColorLabel }, { key: "second" as const, label: secondColorLabel }];

  return (
    <div className="setup-card">
      <div className="segmented mode-tabs" role="group" aria-label="Play modes">
        {modes.map(({ key, label, shortLabel }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={playMode === key}
            onClick={() => onModeChange(key)}
            className="focus-ring"
            disabled={!modeSupport[key].enabled}
            title={modeSupport[key].enabled ? label : modeSupport[key].reason}
          >
            {shortLabel}
          </button>
        ))}
      </div>
      <div className="setup-pickers" data-count={isBotMode ? 2 : 1}>
        <ChoicePicker label="Time control" value={timeControl} onChange={onTimeControlChange} options={timeControls.slice(0, 6).map(control => ({ key: control.key, label: control.key === "freestyle" ? "Untimed" : control.label }))} />
        {isBotMode ? (
          <div className="setup-bot" title={`${botLevelLabel} · ${botStrengthLabel} · target ${botTargetElo}`}>
            <ChoicePicker label="Bot difficulty" value={botDifficulty} onChange={onBotDifficultyChange} options={botDifficultyLevels.map(level => ({ key: level.key, label: level.label }))} />
          </div>
        ) : null}
      </div>
      {showSide ? (
        <div className="segmented" role="group" aria-label="Side">
          {sides.map(side => <button key={side.key} type="button" className="focus-ring" aria-pressed={seatChoice === side.key} onClick={() => onSeatChoiceChange(side.key)}>{side.label}</button>)}
        </div>
      ) : playMode === "online" ? <p className="setup-note">Casual game · sides are assigned when paired</p> : null}
      {gameSetup}
      <div className="play-start-dock">
        <button type="button" onClick={onStartGame} className="focus-ring action-primary play-start-button">
          {startActionLabel}
        </button>
      </div>
    </div>
  );
}

function startLabelForMode(playMode: PlayMode) {
  if (playMode === "online") return "Find Match";
  if (playMode === "room") return "Create Room";
  if (playMode === "spectate") return "Start Watching";
  return "Start Game";
}
