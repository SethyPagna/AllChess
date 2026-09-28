import Link from "next/link";

import { AnalysisReviewPlayback } from "@/components/analysis/review-playback";
import { reviewLabelTone, type ReviewMoment } from "@/lib/analysis/review-moments";
import { analysisPlyHref } from "@/lib/routing/analysis-links";

type ReviewMove = {
  ply: number;
};

type ReviewPlaybackLinksProps = {
  autoPlay: boolean;
  gameId: string;
  locale: string;
  moves: ReviewMove[];
  selectedMoveIndex: number;
};

type ReviewMomentLinkProps = {
  gameId: string;
  locale: string;
  moment: ReviewMoment;
  ply?: number;
};

export function ReviewPlaybackLinks({
  autoPlay,
  gameId,
  locale,
  moves,
  selectedMoveIndex
}: ReviewPlaybackLinksProps) {
  const firstMove = moves[0];
  const lastMove = moves.at(-1);
  const currentMove = moves[selectedMoveIndex] ?? firstMove;
  const previousMove = moves[Math.max(0, selectedMoveIndex - 1)];
  const nextMove = moves[Math.min(moves.length - 1, selectedMoveIndex + 1)];
  const shouldRestartPlayback = selectedMoveIndex >= moves.length - 1;
  const playbackMove = shouldRestartPlayback ? firstMove : nextMove;

  return (
    <AnalysisReviewPlayback
      atEnd={selectedMoveIndex >= moves.length - 1}
      atStart={selectedMoveIndex <= 0}
      autoPlay={autoPlay}
      firstHref={analysisPlyHref(locale, gameId, firstMove?.ply ?? 1)}
      lastHref={analysisPlyHref(locale, gameId, lastMove?.ply ?? firstMove?.ply ?? 1)}
      nextHref={analysisPlyHref(locale, gameId, nextMove?.ply ?? firstMove?.ply ?? 1, { autoplay: autoPlay && !shouldRestartPlayback })}
      pauseHref={analysisPlyHref(locale, gameId, currentMove?.ply ?? firstMove?.ply ?? 1)}
      playHref={analysisPlyHref(locale, gameId, playbackMove?.ply ?? firstMove?.ply ?? 1, { autoplay: true })}
      previousHref={analysisPlyHref(locale, gameId, previousMove?.ply ?? firstMove?.ply ?? 1)}
      stopAtLast={autoPlay && shouldRestartPlayback}
    />
  );
}

export function ReviewMomentLink({ gameId, locale, moment, ply }: ReviewMomentLinkProps) {
  const content = (
    <>
      <strong data-label={reviewLabelTone(moment.label)}>{moment.label}</strong>
      {moment.move}
    </>
  );

  return ply ? (
    <Link href={analysisPlyHref(locale, gameId, ply) as never} className="analysis-detail-link focus-ring">
      {content}
    </Link>
  ) : (
    <span className="analysis-detail-link">{content}</span>
  );
}
