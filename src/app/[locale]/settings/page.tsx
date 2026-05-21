import { Suspense } from "react";

import { InfoHint } from "@/components/info-hint";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { NotificationCenter } from "@/components/shell/notification-center";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

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
      <div className="panel settings-stack">
        <div className="settings-row">
          <div className="settings-row-title">
            <h2>Display</h2>
            <InfoHint text={`${t("settings.light")}, ${t("settings.dark")}, and ${t("settings.system")} appearance controls.`} />
          </div>
          <ThemeToggle
            labels={{
              light: t("settings.light"),
              dark: t("settings.dark"),
              system: t("settings.system")
            }}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-title">
            <h2>{t("settings.language")}</h2>
            <InfoHint text="Open the language menu to switch by full language name while keeping this page path." />
          </div>
          <Suspense fallback={<span className="action-secondary grid h-10 w-10 place-items-center text-sm">...</span>}>
            <LocaleSwitcher active={locale} />
          </Suspense>
        </div>
        <div className="settings-row">
          <div className="settings-row-title">
            <h2>Notifications</h2>
            <InfoHint text="Room, review, account, and match alerts appear here when real events are available." />
          </div>
          <NotificationCenter />
        </div>
      </div>
    </section>
  );
}
