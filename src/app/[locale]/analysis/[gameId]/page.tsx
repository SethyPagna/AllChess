import Link from "next/link";
import { BarChart3, Brain, ChevronLeft, Play } from "lucide-react";

import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function AnalysisPage({
  params
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="analysis-page mx-auto grid max-w-5xl gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black">{t("analysis.title")}</h1>
        <p className="max-w-2xl text-[var(--muted)]">{t("analysis.subtitle")}</p>
      </div>
      <div className="panel analysis-command-bar">
        <span>Game {gameId}</span>
        <Link href={`/${locale}/history`} className="action-secondary focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm">
          <ChevronLeft size={16} />
          Records
        </Link>
      </div>
      <div className="analysis-grid">
        <article className="panel account-empty-state">
          <Brain size={26} />
          <h2>No saved review yet</h2>
          <p>Game review appears after a finished game has move history saved. The review can show best moves, excellent moves, mistakes, blunders, turning points, and training notes when a real record exists.</p>
          <div className="watch-actions">
            <Link href={`/${locale}/play/classic`} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
              <Play size={16} />
              Play first
            </Link>
          </div>
        </article>
        <article className="panel analysis-review-shell">
          <h2>
            <BarChart3 size={18} />
            Review tools
          </h2>
          <div className="analysis-review-rows">
            <span>Move timeline</span>
            <span>Best / excellent / mistake / blunder labels</span>
            <span>First, previous, play, next, last controls</span>
            <span>Position notes and engine-ready explanations</span>
          </div>
        </article>
      </div>
    </section>
  );
}
