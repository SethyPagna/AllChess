import Link from "next/link";
import { BarChart3, History, Play, Search } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { playSetupHref } from "@/lib/routing/play-links";

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="records-page grid gap-4">
      <div className="compact-page-heading">
        <h1 className="text-3xl font-black">{t("history.title")}</h1>
        <InfoHint text={t("history.subtitle")} />
      </div>
      <div className="record-filter-row panel is-empty" aria-label="History filters">
        <label className="catalog-search" title="Search unlocks when saved match records exist.">
          <Search size={18} />
          <span className="sr-only">Search history</span>
          <input aria-label="Search history" disabled placeholder="Search unlocks after saved matches" />
        </label>
        <span className="record-filter-chip" aria-disabled="true">All games</span>
        <span className="record-filter-chip" aria-disabled="true">Recent first</span>
      </div>
      <div className="panel account-empty-state">
        <History size={24} />
        <h2>No saved matches yet</h2>
        <p>Saved games, review links, and rating changes appear here after real matches.</p>
        <InfoHint text="History uses stored match data only. It stays empty until Cloudflare D1 has a real finished game for this account." />
        <div className="watch-actions">
          <Link className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2" href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never}>
            <Play size={16} />
            Play
          </Link>
          <Link className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2" href={`/${locale}/leaderboards`}>
            <BarChart3 size={16} />
            Ratings
          </Link>
        </div>
      </div>
    </section>
  );
}
