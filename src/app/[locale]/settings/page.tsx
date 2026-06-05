import { SettingsPanel } from "@/components/settings/settings-panel";
import { InfoHint } from "@/components/ui/info-hint";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return createPageMetadata(locale, t("settings.title"), "Manage display, language, and event alerts.");
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="settings-page mx-auto max-w-4xl space-y-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black">{t("settings.title")}</h1>
        <InfoHint text="Manage display, language, and event alerts without leaving your current route." />
      </div>
      <SettingsPanel locale={locale} t={t} />
    </section>
  );
}
