"use client";

import Link from "next/link";
import { Languages } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { localeNames, locales, type LocaleCode } from "@/lib/i18n/locales";
import { localizePath } from "@/lib/i18n/navigation";

export function LocaleSwitcher({ active }: { active: LocaleCode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <details className="relative inline-block">
      <summary aria-label="Languages" className="focus-ring action-secondary inline-flex h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm">
        <Languages size={16} />
        <span>{active.toUpperCase()}</span>
      </summary>
      <div className="panel absolute right-0 top-12 z-40 grid max-h-80 w-64 gap-1 overflow-auto p-2 shadow-xl">
        {locales.map((locale) => (
          <Link
            key={locale}
            href={localizePath(currentPath, locale) as never}
            className={`focus-ring rounded-md px-3 py-2 text-sm ${
              locale === active ? "bg-[var(--accent)] font-bold text-black" : "text-[var(--muted)] hover:bg-[var(--surface-soft)]"
            }`}
          >
            {localeNames[locale]}
          </Link>
        ))}
      </div>
    </details>
  );
}
