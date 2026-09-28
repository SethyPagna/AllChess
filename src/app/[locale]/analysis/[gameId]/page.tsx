import Link from "next/link";
import { Brain, ChevronLeft, Swords } from "lucide-react";

import { AnalysisReviewTools } from "@/components/analysis/analysis-review-tools";
import { AnalysisSummaryCard } from "@/components/analysis/analysis-summary-card";
import { EmptyNote } from "@/components/community/empty-note";
import {
  countReviewLabels,
  createReviewMomentLinks,
  createReviewMomentByMove,
  extractReviewMoments,
  extractTrainingIdeas,
  normalizeSelectedMoveIndex
} from "@/lib/analysis/review-moments";
import { getRuntimeAnalysisReview } from "@/lib/analysis/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { safeDecodeRouteSegment } from "@/lib/routing/params";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; gameId: string }> }) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const decodedGameId = safeDecodeRouteSegment(gameId) ?? gameId;
  return createPageMetadata(locale, `${t("analysis.title")} - ${decodedGameId}`, t("analysis.subtitle"));
}

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
  const selectedMoveIndex = normalizeSelectedMoveIndex(query.ply, review.moves);
  const reviewMoments = extractReviewMoments(review.analysis?.report);
  const reviewMomentByMove = createReviewMomentByMove(reviewMoments, review.moves);
  const hasContent = Boolean(review.analysis) || review.moves.length > 0;

  return (
    <section className="cm-page">
      <header className="cm-head">
        <Link href={`/${locale}/history`} className="icon-btn focus-ring cm-back" aria-label="Back to history" title="History">
          <ChevronLeft size={18} />
        </Link>
        <h1>{t("analysis.title")}</h1>
      </header>
      {hasContent ? (
        <div className="analysis-layout">
          <AnalysisSummaryCard
            analysis={review.analysis}
            gameId={decodedGameId}
            locale={locale}
            moveCount={review.moves.length}
            reviewLabelCounts={countReviewLabels(reviewMoments)}
            reviewMomentLinks={createReviewMomentLinks(reviewMoments, reviewMomentByMove)}
            trainingIdeas={extractTrainingIdeas(review.analysis?.report)}
          />
          <AnalysisReviewTools autoPlay={query.autoplay === "1"} gameId={decodedGameId} locale={locale} moves={review.moves} reviewMomentByMove={reviewMomentByMove} selectedMoveIndex={selectedMoveIndex} />
        </div>
      ) : (
        <EmptyNote icon={Brain} title="No saved review yet" text="Finished games you save get a move-by-move review here.">
          <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring">
            <Swords size={16} />
            Play online
          </Link>
        </EmptyNote>
      )}
    </section>
  );
}
