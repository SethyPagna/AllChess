import { CatalogBrowser } from "@/components/catalog-browser";
import { gameFamilies, getCatalogStats, getGameCatalog, type GameFamilyKey, type PlayabilityStatus } from "@/lib/catalog";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

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
  const entries = getGameCatalog();
  const stats = getCatalogStats(entries);
  const initialFamily = isGameFamily(query.family) ? query.family : "all";
  const initialStatus = isPlayability(query.playability) ? query.playability : "all";

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-4xl font-black sm:text-5xl">{t("variants.title")}</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Start with a game family, read the short rules, then practice only the games that are verified for play. {stats.playableGames} ready, {stats.learnGames} rule guides, {stats.comingSoonGames} in progress.
        </p>
      </div>
      <CatalogBrowser entries={entries} initialFamily={initialFamily} initialStatus={initialStatus} locale={locale} />
    </section>
  );
}

function isGameFamily(value: string | undefined): value is GameFamilyKey {
  return Boolean(value && gameFamilies.some((family) => family.key === value));
}

function isPlayability(value: string | undefined): value is PlayabilityStatus {
  return value === "playable" || value === "learn" || value === "coming-soon";
}
