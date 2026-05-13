import { CatalogBrowser } from "@/components/catalog-browser";
import { getCatalogStats, getGameCatalog } from "@/lib/catalog";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function VariantsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const entries = getGameCatalog();
  const stats = getCatalogStats(entries);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-4xl font-black sm:text-5xl">{t("variants.title")}</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          {stats.playableGames} playable, {stats.learnGames} learning, {stats.comingSoonGames} in build.
        </p>
      </div>
      <CatalogBrowser entries={entries} locale={locale} />
    </section>
  );
}
