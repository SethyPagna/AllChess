import { X } from "lucide-react";

import type { GameOutcome } from "@/lib/game/outcome";

type MatchResultOverlayProps = {
  outcome: GameOutcome;
  showModal: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  onReview: () => void;
};

export function MatchResultOverlay({ outcome, showModal, onClose, onPlayAgain, onReview }: MatchResultOverlayProps) {
  return (
    <>
      <div className={`match-result-banner match-result-${outcome.result}`} role="status">
        <strong>{outcome.headline}</strong>
        <span>{outcome.detail}</span>
      </div>
      {outcome.celebrate ? <div className="win-celebration" aria-hidden="true" /> : null}
      {showModal ? (
        <div className={`match-result-modal match-result-${outcome.result}`} role="dialog" aria-label="Match over" aria-modal="false">
          <button type="button" className="match-result-close focus-ring" aria-label="Close match result" title="Close this result panel and view the board." onClick={onClose}>
            <X size={16} />
          </button>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Match over</p>
          <h2>{outcome.headline}</h2>
          <p>{outcome.detail}</p>
          <ul className="match-result-context">
            {outcome.context.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onPlayAgain} className="focus-ring action-primary px-4 py-2 text-sm">
              Play again
            </button>
            <button type="button" onClick={onReview} className="focus-ring action-secondary px-4 py-2 text-sm">
              Review moves
            </button>
            <button type="button" onClick={onClose} className="focus-ring action-secondary px-4 py-2 text-sm">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
