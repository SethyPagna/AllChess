import { SettingsPanel } from "@/components/settings/settings-panel";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return createPageMetadata(locale, t("nav.settings"), "Theme, language, and account.");
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="prefs-page">
      <h1 className="acct-title">{t("nav.settings")}</h1>
      <SettingsPanel locale={locale} t={t} />
    </section>
  );
}
