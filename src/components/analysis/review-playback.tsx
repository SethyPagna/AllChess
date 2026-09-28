"use client";

import { useEffect, type ReactNode } from "react";
import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";

const REVIEW_PLAYBACK_DELAY_MS = 900;

export type AnalysisReviewPlaybackProps = {
  atEnd: boolean;
  atStart: boolean;
  autoPlay: boolean;
  firstHref: string;
  lastHref: string;
  nextHref: string;
  pauseHref: string;
  playHref: string;
  previousHref: string;
  stopAtLast: boolean;
};

export function AnalysisReviewPlayback({
  atEnd,
  atStart,
  autoPlay,
  firstHref,
  lastHref,
  nextHref,
  pauseHref,
  playHref,
  previousHref,
  stopAtLast
}: AnalysisReviewPlaybackProps) {
  useEffect(() => {
    if (!autoPlay || stopAtLast) return;
    const timeoutId = window.setTimeout(() => {
      window.location.assign(playHref);
    }, REVIEW_PLAYBACK_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [autoPlay, playHref, stopAtLast]);

  useEffect(() => {
    const active = document.querySelector<HTMLElement>(".analysis-timeline > .is-active");
    const list = active?.parentElement;
    if (active && list) list.scrollTop = active.offsetTop - (list.clientHeight - active.offsetHeight) / 2;
  }, []);

  useEffect(() => {
    const keys: Record<string, string | null> = {
      ArrowLeft: atStart ? null : previousHref,
      ArrowRight: atEnd ? null : nextHref,
      Home: atStart ? null : firstHref,
      End: atEnd ? null : lastHref
    };
    // Arrows step while nothing else has focus or focus is in the moves card; Home/End only inside
    // the moves card, so they still scroll the page. A step that cannot move leaves the key alone.
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const inMoves = Boolean(target?.closest(".analysis-moves"));
      const onPage = !target || target === document.body || target === document.documentElement;
      if (!inMoves && (!onPage || event.key === "Home" || event.key === "End")) return;
      const href = keys[event.key];
      if (!href) return;
      event.preventDefault();
      window.location.assign(href);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [atEnd, atStart, firstHref, lastHref, nextHref, previousHref]);

  return (
    <div className="analysis-playback" role="group" aria-label="Review playback controls">
      <StepControl disabled={atStart} href={firstHref} label="First" title="First move (Home)">
        <SkipBack size={16} />
      </StepControl>
      <StepControl disabled={atStart} href={previousHref} label="Previous" title="Previous move (←)">
        <StepBack size={16} />
      </StepControl>
      {autoPlay ? (
        <a href={pauseHref} className="icon-btn focus-ring is-playing" aria-label="Pause" title="Pause">
          <Pause size={16} />
        </a>
      ) : (
        <a href={playHref} className="icon-btn focus-ring" aria-label="Play" title="Play through moves">
          <Play size={16} />
        </a>
      )}
      <StepControl disabled={atEnd} href={nextHref} label="Next" title="Next move (→)">
        <StepForward size={16} />
      </StepControl>
      <StepControl disabled={atEnd} href={lastHref} label="Last" title="Last move (End)">
        <SkipForward size={16} />
      </StepControl>
    </div>
  );
}

function StepControl({ children, disabled, href, label, title }: { children: ReactNode; disabled: boolean; href: string; label: string; title: string }) {
  return disabled ? (
    <button type="button" className="icon-btn" disabled aria-label={label} title={title}>
      {children}
    </button>
  ) : (
    <a href={href} className="icon-btn focus-ring" aria-label={label} title={title}>
      {children}
    </a>
  );
}
