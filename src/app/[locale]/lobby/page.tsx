import { LobbyActivity } from "@/components/lobby/lobby-activity";
import { LobbyActions } from "@/components/lobby/lobby-actions";
import { LobbyCatalogStats, LobbyFamilyHighlights, LobbyFeaturedGames } from "@/components/lobby/lobby-catalog-highlights";
import { InfoHint } from "@/components/ui/info-hint";
import { getCatalogStats } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeLiveStats } from "@/lib/realtime/runtime";
import { createDefaultStats } from "@/lib/realtime/stats";

export const dynamic = "force-dynamic";

const featuredGameOrder = new Map([
  ["classic", 0],
  ["crazyhouse", 1],
  ["chess960", 2],
  ["xiangqi", 3],
  ["shogi", 4],
  ["janggi", 5]
]);

export default async function LobbyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const [catalog, liveStats] = await Promise.all([getRuntimeCatalogEntries(), getRuntimeLiveStats()]);
  const stats = getCatalogStats(catalog);
  const featured = [...catalog.filter((entry) => entry.playability === "playable")]
    .sort((a, b) => (featuredGameOrder.get(a.variantKey ?? a.id) ?? 100) - (featuredGameOrder.get(b.variantKey ?? b.id) ?? 100))
    .slice(0, 6);
  const siteStats = createDefaultStats(liveStats);

  return (
    <section className="lobby-dashboard">
      <div className="space-y-5">
        <div className="compact-page-heading">
          <h1 className="text-4xl font-black sm:text-5xl">{t("lobby.title")}</h1>
          <InfoHint text={t("app.description")} />
        </div>
        <LobbyActions locale={locale} />
        <LobbyCatalogStats stats={stats} />
        <LobbyFeaturedGames entries={featured} locale={locale} />
        <LobbyFamilyHighlights locale={locale} stats={stats} />
      </div>
      <LobbyActivity locale={locale} siteStats={siteStats} t={t} />
    </section>
  );
}
