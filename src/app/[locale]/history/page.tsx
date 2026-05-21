import Link from "next/link";
import { BarChart3, History, Play, Search } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { getRuntimeRecentHistory, type HistoryResultFilter, type RuntimeRecentHistory } from "@/lib/history/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string; result?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const history = await getRuntimeRecentHistory(20, { query: query?.q, result: query?.result as HistoryResultFilter | undefined });
  const hasSavedRows = history.totalResults > 0;
  const hasVisibleResults = history.results.length > 0;

  return (
    <section className="records-page grid gap-4">
      <div className="compact-page-heading">
        <h1 className="text-3xl font-black">{t("history.title")}</h1>
        <InfoHint text={t("history.subtitle")} />
      </div>
      <form className={`record-filter-row panel ${hasSavedRows ? "" : "is-empty"}`} aria-label="History filters">
        <label className="catalog-search" title="Search saved games by game, variant, opponent, mode, or result.">
          <Search size={18} />
          <span className="sr-only">Search history</span>
          <input aria-label="Search history" name="q" defaultValue={history.filters.query} placeholder="Search saved games" />
        </label>
        <select className="record-filter-select" name="result" aria-label="Filter history result" defaultValue={history.filters.result}>
          <option value="all">All games</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="draw">Draws</option>
          <option value="unfinished">Unfinished</option>
        </select>
        <button type="submit" className="focus-ring record-filter-chip">
          Search
        </button>
        <span className="record-filter-chip" aria-disabled="true">Recent first</span>
      </form>
      {hasVisibleResults ? <RecentHistoryList history={history} locale={locale} /> : <HistoryEmptyState locale={locale} hasSavedRows={hasSavedRows} />}
    </section>
  );
}

function HistoryEmptyState({ locale, hasSavedRows }: { locale: string; hasSavedRows: boolean }) {
  return (
    <div className="panel account-empty-state">
      <History size={24} />
      <h2>{hasSavedRows ? "No matching games" : "No saved matches yet"}</h2>
      <p>{hasSavedRows ? "Try a different search or result filter." : "Saved games, review links, and rating changes appear here after real matches."}</p>
      <InfoHint text={hasSavedRows ? "Search filters only the saved Cloudflare D1 match rows already available." : "History uses stored match data only. It stays empty until Cloudflare D1 has a real finished game for this account."} />
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
  );
}

function RecentHistoryList({ history, locale }: { history: RuntimeRecentHistory; locale: string }) {
  return (
    <div className="panel profile-history-list">
      <div className="compact-section-heading">
        <h2 className="section-title">Recent saved games</h2>
        <InfoHint text={history.source === "d1" ? "These rows are distinct saved games from Cloudflare D1." : "History stays empty until real saved games exist."} />
      </div>
      <div>
        {history.results.map((result) => (
          <Link key={result.id} href={`/${locale}/analysis/${result.gameId}`} className="focus-ring profile-history-row">
            <span>{result.variantKey}</span>
            <strong>{result.result}</strong>
            <span>{result.outcomeReason ?? result.mode}</span>
            <span>{result.movesPlayed} moves</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
