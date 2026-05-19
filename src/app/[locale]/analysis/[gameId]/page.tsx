import Link from "next/link";
import { BarChart3, Brain, ChevronLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { getRuntimeAnalysisReview } from "@/lib/analysis/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { safeDecodeRouteSegment } from "@/lib/routing/params";
import { playGameHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  params
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const decodedGameId = safeDecodeRouteSegment(gameId) ?? gameId;
  const review = await getRuntimeAnalysisReview(decodedGameId);
  const hasMoves = review.moves.length > 0;
  const hasAnalysis = Boolean(review.analysis);
  const statusLabel = hasAnalysis ? `${review.source.toUpperCase()} review` : "No saved review";

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
          <div className="analysis-review-controls" aria-label="Review playback controls">
            <button type="button" disabled={!hasMoves} title={hasMoves ? "Jump to the first saved position." : "First move unlocks when this game has saved move history."}>
              <SkipBack size={15} />
              First
            </button>
            <button type="button" disabled={!hasMoves} title={hasMoves ? "Replay saved positions from the beginning." : "Playback unlocks after a completed game is saved."}>
              <Play size={15} />
              Play
            </button>
            <button type="button" disabled={!hasMoves} title={hasMoves ? "Step to the next saved move." : "Next move unlocks when review snapshots are available."}>
              <SkipForward size={15} />
              Next
            </button>
          </div>
          {hasMoves ? (
            <ol className="analysis-move-list" aria-label="Saved move timeline">
              {review.moves.slice(0, 16).map((move) => (
                <li key={`${move.gameId}-${move.ply}`}>
                  <strong>{move.ply}.</strong>
                  <span>{move.notation || "Saved move"}</span>
                </li>
              ))}
            </ol>
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
