import { Suspense } from "react";

import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { NotificationCenter } from "@/components/shell/notification-center";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { InfoHint } from "@/components/ui/info-hint";
import type { LocaleCode } from "@/lib/i18n/locales";

type SettingsPanelProps = {
  locale: LocaleCode;
  t: (key: string) => string;
};

export function SettingsPanel({ locale, t }: SettingsPanelProps) {
  return (
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
  );
}
