import Link from "next/link";

import { ReviewPlaybackLinks } from "@/components/analysis/review-controls";
import { getReviewMomentForMove, reviewLabelTone, type ReviewMoment } from "@/lib/analysis/review-moments";
import type { SavedMoveSnapshot } from "@/lib/cloudflare/d1";
import { analysisPlyHref } from "@/lib/routing/analysis-links";

type AnalysisReviewToolsProps = {
  autoPlay: boolean;
  gameId: string;
  locale: string;
  moves: SavedMoveSnapshot[];
  reviewMomentByMove: Map<string, ReviewMoment>;
  selectedMoveIndex: number;
};

export function AnalysisReviewTools({
  autoPlay,
  gameId,
  locale,
  moves,
  reviewMomentByMove,
  selectedMoveIndex
}: AnalysisReviewToolsProps) {
  if (!moves.length) return null;
  const selectedMove = moves[selectedMoveIndex] ?? null;
  const selectedMoment = selectedMove ? getReviewMomentForMove(reviewMomentByMove, selectedMove) : undefined;

  return (
    <article className="cm-card analysis-moves" aria-label="Moves">
      <div className="analysis-player">
        <ReviewPlaybackLinks autoPlay={autoPlay} gameId={gameId} locale={locale} moves={moves} selectedMoveIndex={selectedMoveIndex} />
        {selectedMove ? (
          <div className="analysis-current" aria-label="Selected move"><strong>Ply {selectedMove.ply} of {moves.length}</strong><span>{selectedMove.notation || "Saved move"}</span>{selectedMoment?.label ? <em data-label={reviewLabelTone(selectedMoment.label)}>{selectedMoment.label}</em> : null}</div>
        ) : null}
      </div>
      <ol className="analysis-timeline" aria-label="Saved move timeline">
        {moves.map((move) => {
          const moment = getReviewMomentForMove(reviewMomentByMove, move);

          return (
            <li key={`${move.gameId}-${move.ply}`} className={selectedMove?.ply === move.ply ? "is-active" : undefined}>
              <Link href={analysisPlyHref(locale, gameId, move.ply) as never} className="focus-ring" aria-current={selectedMove?.ply === move.ply ? "step" : undefined}>
                <strong>{move.ply}.</strong>
                <span>{move.notation || "Saved move"}</span>
                {moment?.label ? <em data-label={reviewLabelTone(moment.label)}>{moment.label}</em> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
