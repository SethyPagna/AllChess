import Link from "next/link";
import { BarChart3, ChevronLeft, Pause } from "lucide-react";

import { AnalysisSummaryCard } from "@/components/analysis/analysis-summary-card";
import { EmptyReviewPlaybackControls, ReviewPlaybackLinks } from "@/components/analysis/review-controls";
import { InfoHint } from "@/components/ui/info-hint";
import {
  countReviewLabels,
  createReviewMomentByMove,
  extractReviewMoments,
  extractTrainingIdeas,
  getReviewMomentForMove,
  normalizeSelectedMoveIndex,
  reviewLabelTone,
  reviewMomentKey
} from "@/lib/analysis/review-moments";
import { getRuntimeAnalysisReview } from "@/lib/analysis/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { analysisPlyHref } from "@/lib/routing/analysis-links";
import { safeDecodeRouteSegment } from "@/lib/routing/params";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; gameId: string }>;
  searchParams?: Promise<{ autoplay?: string; ply?: string }>;
}) {
  const { locale: rawLocale, gameId } = await params;
  const query = (await searchParams) ?? {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const decodedGameId = safeDecodeRouteSegment(gameId) ?? gameId;
  const review = await getRuntimeAnalysisReview(decodedGameId);
  const hasMoves = review.moves.length > 0;
  const hasAnalysis = Boolean(review.analysis);
  const statusLabel = hasAnalysis ? `${review.source.toUpperCase()} review` : "No saved review";
  const selectedMoveIndex = normalizeSelectedMoveIndex(query.ply, review.moves);
  const selectedMove = review.moves[selectedMoveIndex] ?? null;
  const reviewMoments = extractReviewMoments(review.analysis?.report);
  const reviewMomentByMove = createReviewMomentByMove(reviewMoments, review.moves);
  const selectedMoment = selectedMove ? getReviewMomentForMove(reviewMomentByMove, selectedMove) : undefined;
  const reviewLabelCounts = countReviewLabels(reviewMoments);
  const reviewMomentLinks = reviewMoments.map((moment) => ({
    moment,
    ply: moment.ply ?? reviewMomentByMove.get(reviewMomentKey(moment.move))?.ply
  }));
  const trainingIdeas = extractTrainingIdeas(review.analysis?.report);

  return (
    <section className="analysis-page mx-auto grid max-w-5xl gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black">{t("analysis.title")}</h1>
        <InfoHint text={t("analysis.subtitle")} />
      </div>
      <div className="panel analysis-command-bar">
        <span>Game {decodedGameId}</span>
        <span>{statusLabel}</span>
        <Link href={`/${locale}/profile/player`} className="action-secondary focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm">
          <ChevronLeft size={16} />
          Records
        </Link>
      </div>
      <div className="analysis-grid">
        <AnalysisSummaryCard analysis={review.analysis} gameId={decodedGameId} locale={locale} moveCount={review.moves.length} reviewLabelCounts={reviewLabelCounts} reviewMomentLinks={reviewMomentLinks} trainingIdeas={trainingIdeas} />
        <article className="panel analysis-review-shell">
          <h2>
            <BarChart3 size={18} />
            Review tools
          </h2>
          {hasMoves ? <ReviewPlaybackLinks autoPlay={query.autoplay === "1"} gameId={decodedGameId} locale={locale} moves={review.moves} selectedMoveIndex={selectedMoveIndex} /> : <EmptyReviewPlaybackControls />}
          {hasMoves ? (
            <>
              {selectedMove ? (
                <div className="analysis-selected-move" aria-label="Selected move">
                  <strong>
                    Ply {selectedMove.ply} of {review.moves.length}
                  </strong>
                  <span>{selectedMove.notation || "Saved move"}</span>
                  {selectedMoment?.label ? <em data-label={reviewLabelTone(selectedMoment.label)}>{selectedMoment.label}</em> : null}
                </div>
              ) : null}
              <ol className="analysis-move-list" aria-label="Saved move timeline">
                {review.moves.slice(0, 16).map((move) => {
                  const moment = getReviewMomentForMove(reviewMomentByMove, move);

                  return (
                    <li key={`${move.gameId}-${move.ply}`} className={selectedMove?.ply === move.ply ? "is-active" : undefined}>
                      <Link href={analysisPlyHref(locale, decodedGameId, move.ply) as never} className="focus-ring">
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
      </div>
    </section>
  );
}
