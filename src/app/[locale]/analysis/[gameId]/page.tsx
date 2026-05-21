import Link from "next/link";
import { BarChart3, Brain, ChevronLeft, Pause, Play } from "lucide-react";

import { EmptyReviewPlaybackControls, ReviewMomentLink, ReviewPlaybackLinks } from "@/components/analysis/review-controls";
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
import { playGameHref } from "@/lib/routing/play-links";

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
        {review.analysis ? (
          <article className="panel analysis-summary-card">
            <Brain size={26} />
            <h2>Saved review</h2>
            <p>{review.analysis.summary}</p>
            <dl>
              <div>
                <dt>Provider</dt>
                <dd>{review.analysis.provider}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{review.analysis.model}</dd>
              </div>
              <div>
                <dt>Moves</dt>
                <dd>{review.moves.length}</dd>
              </div>
            </dl>
            {reviewLabelCounts.length ? (
              <div className="analysis-label-counts" aria-label="Review label counts">
                {reviewLabelCounts.map((item) => (
                  <span key={item.label} data-label={item.tone}>
                    <strong>{item.count}</strong>
                    {item.label}
                  </span>
                ))}
              </div>
            ) : null}
            {reviewMoments.length ? (
              <div className="analysis-detail-list" aria-label="Key review moments">
                <h3>Key moments</h3>
                {reviewMoments.map((moment) => (
                  <ReviewMomentLink key={`${moment.move}-${moment.label}-${moment.ply ?? "move"}`} gameId={decodedGameId} locale={locale} moment={moment} ply={moment.ply ?? reviewMomentByMove.get(reviewMomentKey(moment.move))?.ply} />
                ))}
              </div>
            ) : null}
            {trainingIdeas.length ? (
              <div className="analysis-detail-list" aria-label="Training ideas">
                <h3>Train next</h3>
                {trainingIdeas.map((idea) => (
                  <span key={idea}>{idea}</span>
                ))}
              </div>
            ) : null}
          </article>
        ) : (
          <article className="panel account-empty-state">
            <Brain size={26} />
            <h2>No saved review yet</h2>
            <p>Finish a game to unlock move labels, turning points, and replay controls.</p>
            <div className="watch-actions">
              <Link href={playGameHref(locale, "classic", { mode: "offline", time: "rapid" }) as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
                <Play size={16} />
                Play first
              </Link>
            </div>
          </article>
        )}
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
