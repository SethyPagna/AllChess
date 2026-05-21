import { AnalysisCommandBar } from "@/components/analysis/analysis-command-bar";
import { AnalysisReviewTools } from "@/components/analysis/analysis-review-tools";
import { AnalysisSummaryCard } from "@/components/analysis/analysis-summary-card";
import { InfoHint } from "@/components/ui/info-hint";
import {
  countReviewLabels,
  createReviewMomentByMove,
  extractReviewMoments,
  extractTrainingIdeas,
  normalizeSelectedMoveIndex,
  reviewMomentKey
} from "@/lib/analysis/review-moments";
import { getRuntimeAnalysisReview } from "@/lib/analysis/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
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
  const hasAnalysis = Boolean(review.analysis);
  const statusLabel = hasAnalysis ? `${review.source.toUpperCase()} review` : "No saved review";
  const selectedMoveIndex = normalizeSelectedMoveIndex(query.ply, review.moves);
  const reviewMoments = extractReviewMoments(review.analysis?.report);
  const reviewMomentByMove = createReviewMomentByMove(reviewMoments, review.moves);
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
      <AnalysisCommandBar gameId={decodedGameId} locale={locale} statusLabel={statusLabel} />
      <div className="analysis-grid">
        <AnalysisSummaryCard analysis={review.analysis} gameId={decodedGameId} locale={locale} moveCount={review.moves.length} reviewLabelCounts={reviewLabelCounts} reviewMomentLinks={reviewMomentLinks} trainingIdeas={trainingIdeas} />
        <AnalysisReviewTools autoPlay={query.autoplay === "1"} gameId={decodedGameId} locale={locale} moves={review.moves} reviewMomentByMove={reviewMomentByMove} selectedMoveIndex={selectedMoveIndex} />
      </div>
    </section>
  );
}
