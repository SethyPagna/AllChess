"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { localeNames, locales, type LocaleCode } from "@/lib/i18n/locales";
import { localizePath } from "@/lib/i18n/navigation";

export function LanguageSelect({ id, active }: { id: string; active: LocaleCode }) {
  const router = useRouter();
  const pathname = usePathname() ?? `/${active}/settings`;

  return (
    <span className="prefs-select">
      <select
        id={id}
        className="focus-ring"
        value={active}
        onChange={(event) => router.push(localizePath(pathname, event.target.value as LocaleCode) as never)}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>{localeNames[locale]}</option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  );
}
