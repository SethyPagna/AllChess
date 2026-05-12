import Link from "next/link";

import { localeNames, locales, type LocaleCode } from "@/lib/i18n/locales";

export function LocaleSwitcher({ active }: { active: LocaleCode }) {
  return (
    <div className="flex max-w-full gap-2 overflow-x-auto py-1" aria-label="Languages">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={`/${locale}`}
          className={`focus-ring shrink-0 rounded-md border px-3 py-2 text-sm ${
            locale === active
              ? "border-[var(--accent)] bg-[var(--accent)] text-black"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
          }`}
        >
          {localeNames[locale]}
        </Link>
      ))}
    </div>
  );
}
