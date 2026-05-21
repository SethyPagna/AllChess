import { BookOpen, Eye, Share2, Swords } from "lucide-react";

type PlayMatchHeaderProps = {
  meta: string;
  modeSummary: string;
  objective: string;
  onOpenGuide: () => void;
  onSelectRoom: () => void;
  onSelectWatch: () => void;
  phaseLabel: string;
  showGuide: boolean;
  title: string;
};

export function PlayMatchHeader({ meta, modeSummary, objective, onOpenGuide, onSelectRoom, onSelectWatch, phaseLabel, showGuide, title }: PlayMatchHeaderProps) {
  return (
    <div className="play-panel-match-header">
      <div className="play-title-block">
        <div className="play-title-row">
          <h1>{title}</h1>
          <div className="play-title-actions" aria-label="Match actions">
            {showGuide ? (
              <button type="button" title="Open guide, win conditions, and draw notes." onClick={onOpenGuide} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" aria-label="Game guide">
                <BookOpen size={16} />
                Guide
              </button>
            ) : null}
            <button type="button" onClick={onSelectRoom} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title="Switch to room setup for a shareable game.">
              <Share2 size={16} />
              <span className="button-label">Room</span>
            </button>
            <button type="button" onClick={onSelectWatch} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title="Switch to spectator mode for live rooms.">
              <Eye size={16} />
              <span className="button-label">Watch</span>
            </button>
          </div>
        </div>
        <div className="play-title-meta" aria-label="Match summary">
          <span className="inline-flex items-center gap-2">
            <Swords size={14} />
            {meta}
          </span>
          <strong title={objective}>{modeSummary}</strong>
          <em>{phaseLabel}</em>
        </div>
      </div>
    </div>
  );
}
