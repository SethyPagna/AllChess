import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { parseCatalogFamily, parseCatalogMode, parsePlayabilityStatus } from "@/lib/routing/params";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return createPageMetadata(locale, t("variants.title"), t("variants.subtitle"));
}

export default async function VariantsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ family?: string; mode?: string; playability?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const entries = await getRuntimeCatalogEntries();

  return (
    <div className="catalog-page">
      <CatalogBrowser
        title={t("nav.variants")}
        entries={entries}
        initialFamily={parseCatalogFamily(query.family ?? null) ?? "all"}
        initialMode={parseCatalogMode(query.mode ?? null) ?? "all"}
        initialStatus={parsePlayabilityStatus(query.playability ?? null) ?? "all"}
        locale={locale}
      />
    </div>
  );
}
