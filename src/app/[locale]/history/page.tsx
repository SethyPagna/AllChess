import { HistoryEmptyState } from "@/components/history/history-empty-state";
import { HistoryFilterBar } from "@/components/history/history-filter-bar";
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
      <HistoryFilterBar hasSavedRows={hasSavedRows} history={history} />
      {hasVisibleResults ? <RecentHistoryList history={history} locale={locale} /> : <HistoryEmptyState hasSavedRows={hasSavedRows} locale={locale} />}
    </section>
  );
}
