import { Search } from "lucide-react";

import { HistoryEmptyState } from "@/components/history/history-empty-state";
import { RecentHistoryList } from "@/components/history/recent-history-list";
import { InfoHint } from "@/components/ui/info-hint";
import { getRuntimeRecentHistory, type HistoryResultFilter } from "@/lib/history/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

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
      {hasVisibleResults ? <RecentHistoryList history={history} locale={locale} /> : <HistoryEmptyState hasSavedRows={hasSavedRows} locale={locale} />}
    </section>
  );
}
