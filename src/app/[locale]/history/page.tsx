import Link from "next/link";
import { BarChart3, History, Play, Search } from "lucide-react";

import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="records-page grid gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black">{t("history.title")}</h1>
        <p className="max-w-2xl text-[var(--muted)]">{t("history.subtitle")}</p>
      </div>
      <div className="record-filter-row panel">
        <label className="catalog-search focus-within:ring-2 focus-within:ring-[var(--accent)]">
          <Search size={18} />
          <span className="sr-only">Search history</span>
          <input placeholder="Search game, opponent, result" />
        </label>
        <span className="record-filter-chip">All games</span>
        <span className="record-filter-chip">Recent first</span>
      </div>
      <div className="panel account-empty-state">
        <History size={26} />
        <h2>No saved matches yet</h2>
        <p>Finished games will appear here after Cloudflare D1 records a real match result. Replays, review links, ratings, and exports stay empty until there is real account data.</p>
        <div className="watch-actions">
          <Link className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2" href={`/${locale}/play`}>
            <Play size={16} />
            Play a game
          </Link>
          <Link className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2" href={`/${locale}/leaderboards`}>
            <BarChart3 size={16} />
            View ratings
          </Link>
        </div>
      </div>
    </section>
  );
}
