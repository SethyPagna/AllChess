import { SavedMatches } from "@/components/board/saved-matches";
import { HistoryEmptyState } from "@/components/history/history-empty-state";
import { HistoryFilterBar } from "@/components/history/history-filter-bar";
import { RecentHistoryList } from "@/components/history/recent-history-list";
import { getRuntimeRecentHistory, type HistoryResultFilter } from "@/lib/history/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return createPageMetadata(locale, t("nav.history"), t("history.subtitle"));
}

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

  return (
    <section className="cm-page">
      <header className="cm-head">
        <h1>{t("nav.history")}</h1>
      </header>
      {/* Games saved on this device (with import); online results follow. */}
      <SavedMatches locale={locale} />
      {hasSavedRows ? <HistoryFilterBar history={history} locale={locale} /> : null}
      {history.results.length ? <RecentHistoryList history={history} locale={locale} /> : <HistoryEmptyState hasSavedRows={hasSavedRows} locale={locale} />}
    </section>
  );
}
