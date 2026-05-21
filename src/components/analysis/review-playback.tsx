"use client";

import { useEffect } from "react";
import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";

const REVIEW_PLAYBACK_DELAY_MS = 900;

export type AnalysisReviewPlaybackProps = {
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

  return (
    <div className="analysis-review-controls" aria-label="Review playback controls">
      <a href={firstHref} className="focus-ring" title="Jump to the first saved position.">
        <SkipBack size={15} />
        First
      </a>
      <a href={previousHref} className="focus-ring" title="Step to the previous saved move.">
        <StepBack size={15} />
        Previous
      </a>
      {autoPlay ? (
        <a href={pauseHref} className="focus-ring" title="Pause review playback on this saved move.">
          <Pause size={15} />
          Pause
        </a>
      ) : (
        <a href={playHref} className="focus-ring" title="Play through the saved move timeline.">
          <Play size={15} />
          Play
        </a>
      )}
      <a href={nextHref} className="focus-ring" title="Step to the next saved move.">
        <StepForward size={15} />
        Next
      </a>
      <a href={lastHref} className="focus-ring" title="Jump to the final saved position.">
        <SkipForward size={15} />
        Last
      </a>
    </div>
  );
}
