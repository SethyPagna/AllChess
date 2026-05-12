import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-4xl font-black">{t("settings.title")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("app.description")}</p>
      </div>
      <div className="panel grid gap-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{t("settings.theme")}</h2>
            <p className="text-sm text-[var(--muted)]">{t("settings.light")} / {t("settings.dark")} / {t("settings.system")}</p>
          </div>
          <ThemeToggle
            labels={{
              light: t("settings.light"),
              dark: t("settings.dark"),
              system: t("settings.system")
            }}
          />
        </div>
        <div className="grid gap-3">
          <h2 className="text-lg font-bold">{t("settings.language")}</h2>
          <LocaleSwitcher active={locale} />
        </div>
      </div>
    </section>
  );
}
