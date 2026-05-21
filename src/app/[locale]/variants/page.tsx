import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { CatalogTrainingMetrics } from "@/components/catalog/catalog-training-metrics";
import { getBotTrainingGateSummary, listBotKnowledgeSummary } from "@/lib/bot/training";
import { listBotStrengthBands } from "@/lib/bot/strength";
import { getCatalogStats } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { parseCatalogFamily, parsePlayabilityStatus } from "@/lib/routing/params";

export const dynamic = "force-dynamic";

export default async function VariantsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ family?: string; playability?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const entries = await getRuntimeCatalogEntries();
  const stats = getCatalogStats(entries);
  const knowledge = listBotKnowledgeSummary();
  const trainingGate = getBotTrainingGateSummary();
  const strengthBands = listBotStrengthBands();
  const legendBand = strengthBands[strengthBands.length - 1];
  const initialFamily = parseCatalogFamily(query.family ?? null) ?? "all";
  const initialStatus = parsePlayabilityStatus(query.playability ?? null) ?? "all";

  return (
    <section className="grid gap-6">
      <div className="games-rules-heading panel">
        <h1>{t("variants.title")}</h1>
        <span>{stats.playableGames} ready</span>
        <span>{stats.learnGames} guides</span>
        <span>{stats.comingSoonGames} building</span>
      </div>
      <CatalogTrainingMetrics knowledge={knowledge} legendBand={legendBand} trainingGate={trainingGate} />
      <CatalogBrowser entries={entries} initialFamily={initialFamily} initialStatus={initialStatus} locale={locale} />
    </section>
  );
}
