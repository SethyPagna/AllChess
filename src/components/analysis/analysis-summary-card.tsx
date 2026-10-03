import { ReviewMomentLink } from "@/components/analysis/review-controls";
import type { ReviewLabelTone, ReviewMoment } from "@/lib/analysis/review-moments";
import type { RuntimeAnalysisReview } from "@/lib/analysis/runtime";

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
    return <p className="cm-card analysis-note">No saved review for this game yet.</p>;
  }

  return (
    <article className="cm-card analysis-summary" aria-labelledby="analysis-summary-title">
      <h2 id="analysis-summary-title">Summary</h2>
      <p>{analysis.summary}</p>
      <p className="analysis-meta">{[analysis.provider, analysis.model, `${moveCount} moves`].filter(Boolean).join(" · ")}</p>
      {reviewLabelCounts.length ? (
        <div className="analysis-counts" aria-label="Review label counts">
          {reviewLabelCounts.map((item) => (
            <span key={item.label} data-label={item.tone}>
              <strong>{item.count}</strong>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      {reviewMomentLinks.length ? (
        <section className="analysis-block" aria-label="Key review moments">
          <h3>Key moments</h3>
          <div className="analysis-moments">
            {reviewMomentLinks.map(({ moment, ply }) => (
              <ReviewMomentLink key={`${moment.move}-${moment.label}-${ply ?? "move"}`} gameId={gameId} locale={locale} moment={moment} ply={ply} />
            ))}
          </div>
        </section>
      ) : null}
      {trainingIdeas.length ? (
        <section className="analysis-block" aria-label="Training ideas">
          <h3>Train next</h3>
          <ul>
            {trainingIdeas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
