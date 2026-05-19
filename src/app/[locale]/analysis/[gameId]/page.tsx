import Link from "next/link";
import { BarChart3, Brain, ChevronLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { AnalysisReviewPlayback } from "@/components/analysis-review-playback";
import { InfoHint } from "@/components/info-hint";
import { getRuntimeAnalysisReview } from "@/lib/analysis/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
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
            {reviewMoments.length ? (
              <div className="analysis-detail-list" aria-label="Key review moments">
                <h3>Key moments</h3>
                {reviewMoments.map((moment) => (
                  <span key={`${moment.move}-${moment.label}`}>
                    <strong>{moment.label}</strong>
                    {moment.move}
                  </span>
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
                </div>
              ) : null}
              <ol className="analysis-move-list" aria-label="Saved move timeline">
                {review.moves.slice(0, 16).map((move) => (
                  <li key={`${move.gameId}-${move.ply}`} className={selectedMove?.ply === move.ply ? "is-active" : undefined}>
                    <Link href={analysisPlyHref(locale, decodedGameId, move.ply) as never} className="focus-ring">
                      <strong>{move.ply}.</strong>
                      <span>{move.notation || "Saved move"}</span>
                    </Link>
                  </li>
                ))}
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

function EmptyReviewPlaybackControls() {
  return (
    <div className="analysis-review-controls" aria-label="Review playback controls">
      <button type="button" disabled title="First move unlocks when this game has saved move history.">
        <SkipBack size={15} />
        First
      </button>
      <button type="button" disabled title="Playback unlocks after a completed game is saved.">
        <Play size={15} />
        Play
      </button>
      <button type="button" disabled title="Next move unlocks when review snapshots are available.">
        <SkipForward size={15} />
        Next
      </button>
      <button type="button" disabled title="Last move unlocks when this game has saved move history.">
        <SkipForward size={15} />
        Last
      </button>
    </div>
  );
}

function ReviewPlaybackLinks({
  autoPlay,
  gameId,
  locale,
  moves,
  selectedMoveIndex
}: {
  autoPlay: boolean;
  gameId: string;
  locale: string;
  moves: RuntimeAnalysisMoves;
  selectedMoveIndex: number;
}) {
  const firstMove = moves[0];
  const lastMove = moves.at(-1);
  const currentMove = moves[selectedMoveIndex] ?? firstMove;
  const previousMove = moves[Math.max(0, selectedMoveIndex - 1)];
  const nextMove = moves[Math.min(moves.length - 1, selectedMoveIndex + 1)];
  const shouldRestartPlayback = selectedMoveIndex >= moves.length - 1;
  const playbackMove = shouldRestartPlayback ? firstMove : nextMove;

  return (
    <AnalysisReviewPlayback
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

type RuntimeAnalysisMoves = Awaited<ReturnType<typeof getRuntimeAnalysisReview>>["moves"];

function normalizeSelectedMoveIndex(value: string | undefined, moves: RuntimeAnalysisMoves) {
  if (!moves.length) return 0;
  const requestedPly = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(requestedPly)) return 0;
  const requestedIndex = moves.findIndex((move) => move.ply === requestedPly);

  return requestedIndex >= 0 ? requestedIndex : 0;
}

function analysisPlyHref(locale: string, gameId: string, ply: number, options: { autoplay?: boolean } = {}) {
  const autoplayParam = options.autoplay ? "&autoplay=1" : "";

  return `/${locale}/analysis/${encodeURIComponent(gameId)}?ply=${ply}${autoplayParam}`;
}

type ReviewMoment = {
  label: string;
  move: string;
};

function extractReviewMoments(report: unknown): ReviewMoment[] {
  if (!isRecord(report) || !Array.isArray(report.moments)) return [];

  return report.moments
    .map((moment) => {
      if (!isRecord(moment)) return null;
      const label = normalizeDetailText(moment.label);
      const move = normalizeDetailText(moment.move);
      return label || move ? { label: label || "Moment", move: move || "Saved position" } : null;
    })
    .filter((moment): moment is ReviewMoment => Boolean(moment))
    .slice(0, 4);
}

function extractTrainingIdeas(report: unknown): string[] {
  if (!isRecord(report) || !Array.isArray(report.training)) return [];

  return report.training.map(normalizeDetailText).filter(Boolean).slice(0, 4);
}

function normalizeDetailText(value: unknown) {
  return String(value ?? "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
