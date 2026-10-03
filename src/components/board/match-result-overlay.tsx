"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import type { GameOutcome } from "@/lib/game/outcome";

type MatchResultOverlayProps = {
  outcome: GameOutcome;
  showModal: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  onReview: () => void;
  playAgainLabel?: string;
  playAgainDisabled?: boolean;
  onCancelRematch?: () => void;
};

export function MatchResultOverlay({ outcome, showModal, onClose, onPlayAgain, onReview, playAgainLabel = "Play again", playAgainDisabled = false, onCancelRematch }: MatchResultOverlayProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!showModal || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, [showModal]);
  return (
    <>
      {!showModal ? <div className={`match-result-banner match-result-${outcome.result}`} role="status">
        <strong>{outcome.headline}</strong>
        <span>{outcome.detail}</span>
      </div> : null}
      {outcome.celebrate ? <div className="win-celebration" aria-hidden="true" /> : null}
      {showModal ? (
        <dialog ref={dialog} className={`match-result-modal match-result-${outcome.result}`} aria-label="Match over" aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, summary, [tabindex]")).filter(element => element.tabIndex >= 0 && !element.hasAttribute("disabled") && element.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
          <button type="button" className="match-result-close focus-ring" aria-label="Close match result" title="Close this result panel and view the board." onClick={onClose}>
            <X size={16} />
          </button>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Match over</p>
          <h2>{outcome.headline}</h2>
          <p id={descriptionId}>{outcome.context[0]}</p>
          <details className="match-result-details"><summary>Result details</summary><p>{outcome.detail}</p>
          <ul className="match-result-context">
            {outcome.context.slice(1).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          </details>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onPlayAgain} disabled={playAgainDisabled} className="focus-ring action-primary px-4 py-2 text-sm">
              {playAgainLabel}
            </button>
            {onCancelRematch ? <button type="button" onClick={onCancelRematch} className="focus-ring action-secondary px-4 py-2 text-sm">Cancel offer</button> : null}
            <button type="button" onClick={onReview} className="focus-ring action-secondary px-4 py-2 text-sm">
              Review moves
            </button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
