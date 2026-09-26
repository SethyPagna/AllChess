import Link from "next/link";
import { Brain, Play } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ReviewMomentLink } from "@/components/analysis/review-controls";
import type { ReviewLabelTone, ReviewMoment } from "@/lib/analysis/review-moments";
import type { RuntimeAnalysisReview } from "@/lib/analysis/runtime";
import { playGameHref } from "@/lib/routing/play-links";

type ReviewLabelCount = {
  count: number;
  label: string;
  tone: ReviewLabelTone;
};

type ReviewMomentSummaryLink = {
  moment: ReviewMoment;
  ply?: number;
};

type AnalysisSummaryCardProps = {
  analysis: RuntimeAnalysisReview["analysis"];
  gameId: string;
  locale: string;
  moveCount: number;
  reviewLabelCounts: ReviewLabelCount[];
  reviewMomentLinks: ReviewMomentSummaryLink[];
  trainingIdeas: string[];
};

export function AnalysisSummaryCard({
  analysis,
  gameId,
  locale,
  moveCount,
  reviewLabelCounts,
  reviewMomentLinks,
  trainingIdeas
}: AnalysisSummaryCardProps) {
  if (!analysis) {
    return (
      <EmptyState className="panel" icon={Brain} title="No saved review yet" help="Recorded games can include move labels, turning points and replay controls.">
        <div className="watch-actions">
          <Link href={playGameHref(locale, "classic", { mode: "offline", time: "rapid" }) as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
            <Play size={16} />
            Play first
          </Link>
        </div>
      </EmptyState>
    );
  }

  return (
    <article className="panel analysis-summary-card">
      <Brain size={26} />
      <h2>Saved review</h2>
      <p>{analysis.summary}</p>
      <details className="studio-disclosure"><summary>Review details</summary><dl>
        <div>
          <dt>Provider</dt>
          <dd>{analysis.provider}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{analysis.model}</dd>
        </div>
        <div>
          <dt>Moves</dt>
          <dd>{moveCount}</dd>
        </div>
      </dl></details>
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
      {reviewMomentLinks.length ? (
        <div className="analysis-detail-list" aria-label="Key review moments">
          <h3>Key moments</h3>
          {reviewMomentLinks.map(({ moment, ply }) => (
            <ReviewMomentLink key={`${moment.move}-${moment.label}-${ply ?? "move"}`} gameId={gameId} locale={locale} moment={moment} ply={ply} />
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
  );
}
