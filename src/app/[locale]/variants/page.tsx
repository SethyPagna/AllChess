import { VariantCard } from "@/components/variant-card";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVariantRuleSummary } from "@/lib/rules-atlas";
import { variantCatalog } from "@/lib/variants";

export default async function VariantsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-4xl font-black sm:text-5xl">{t("variants.title")}</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">{t("variants.subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {variantCatalog.map((variant) => (
          <VariantCard key={variant.key} locale={locale} variant={variant} name={t(variant.nameKey)} ruleSummary={getVariantRuleSummary(variant.key)} />
        ))}
      </div>
    </section>
  );
}
