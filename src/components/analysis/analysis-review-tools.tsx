import Link from "next/link";
import { BarChart3, Pause } from "lucide-react";

import { EmptyReviewPlaybackControls, ReviewPlaybackLinks } from "@/components/analysis/review-controls";
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
  const hasMoves = moves.length > 0;
  const selectedMove = moves[selectedMoveIndex] ?? null;
  const selectedMoment = selectedMove ? getReviewMomentForMove(reviewMomentByMove, selectedMove) : undefined;

  return (
    <article className="panel analysis-review-shell">
      <h2>
        <BarChart3 size={18} />
        Review tools
      </h2>
      {hasMoves ? <ReviewPlaybackLinks autoPlay={autoPlay} gameId={gameId} locale={locale} moves={moves} selectedMoveIndex={selectedMoveIndex} /> : <EmptyReviewPlaybackControls />}
      {hasMoves ? (
        <>
          {selectedMove ? (
            <div className="analysis-selected-move" aria-label="Selected move">
              <strong>
                Ply {selectedMove.ply} of {moves.length}
              </strong>
              <span>{selectedMove.notation || "Saved move"}</span>
              {selectedMoment?.label ? <em data-label={reviewLabelTone(selectedMoment.label)}>{selectedMoment.label}</em> : null}
            </div>
          ) : null}
          <ol className="analysis-move-list" aria-label="Saved move timeline">
            {moves.slice(0, 16).map((move) => {
              const moment = getReviewMomentForMove(reviewMomentByMove, move);

              return (
                <li key={`${move.gameId}-${move.ply}`} className={selectedMove?.ply === move.ply ? "is-active" : undefined}>
                  <Link href={analysisPlyHref(locale, gameId, move.ply) as never} className="focus-ring">
                    <strong>{move.ply}.</strong>
                    <span>{move.notation || "Saved move"}</span>
                    {moment?.label ? <em data-label={reviewLabelTone(moment.label)}>{moment.label}</em> : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <div className="analysis-review-rows">
          <span>Move timeline</span>
          <span>Best / excellent / mistake / blunder labels</span>
          <span>
            <Pause size={14} />
            Playback controls unlock after saved moves
          </span>
          <span>Position notes and engine-ready explanations</span>
        </div>
      )}
    </article>
  );
}
