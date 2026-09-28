import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown } from "lucide-react";

import { LanguageSelect } from "@/components/settings/language-select";
import { ThemeChoices } from "@/components/settings/theme-choices";
import { localeNames, type LocaleCode } from "@/lib/i18n/locales";

type SettingsPanelProps = {
  locale: LocaleCode;
  t: (key: string) => string;
};

export function SettingsPanel({ locale, t }: SettingsPanelProps) {
  const languageLabel = t("settings.language");

  return (
    <div className="prefs-group">
      <div className="prefs-row">
        <span className="prefs-label">{t("settings.theme")}</span>
        <ThemeChoices
          label={t("settings.theme")}
          labels={{
            light: t("settings.light"),
            dark: t("settings.dark"),
            system: t("settings.system")
          }}
        />
      </div>
      <div className="prefs-row">
        <label className="prefs-label" htmlFor="prefs-language">{languageLabel}</label>
        <Suspense
          fallback={
            <span className="prefs-select">
              <select id="prefs-language" disabled defaultValue={locale}>
                <option value={locale}>{localeNames[locale]}</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          }
        >
          <LanguageSelect id="prefs-language" active={locale} />
        </Suspense>
      </div>
      <div className="prefs-row">
        <span className="prefs-label">{t("nav.account")}</span>
        <Link href={`/${locale}/login`} className="action-secondary focus-ring">{t("nav.login")}</Link>
      </div>
    </div>
  );
}
