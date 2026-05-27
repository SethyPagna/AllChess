import { Activity, RotateCcw } from "lucide-react";

type PlayActiveSetupCardProps = {
  humanColorLabel: string;
  modeLabel: string;
  onReset: () => void;
  onShowStatus: () => void;
  timeControlLabel: string;
};

export function PlayActiveSetupCard({ humanColorLabel, modeLabel, onReset, onShowStatus, timeControlLabel }: PlayActiveSetupCardProps) {
  return (
    <div className="play-options-card play-active-setup-card">
      <div className="play-options-heading">
        <Activity size={18} />
        <span>Game in progress</span>
      </div>
      <div className="active-setup-summary">
        <span>{modeLabel}</span>
        <strong>{timeControlLabel}</strong>
        <small>You are {humanColorLabel}. Open Status for side, clock, bot tier, and move details.</small>
      </div>
      <div className="play-action-row">
        <button type="button" onClick={onShowStatus} className="focus-ring action-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm">
          <Activity size={16} />
          Status
        </button>
        <button type="button" onClick={onReset} className="focus-ring action-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm">
          <RotateCcw size={16} />
          New setup
        </button>
      </div>
    </div>
  );
}
