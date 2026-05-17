"use client";

import Link from "next/link";
import { Check, Languages } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { localeNames, locales, type LocaleCode } from "@/lib/i18n/locales";
import { localizePath } from "@/lib/i18n/navigation";
import { closeOtherShellMenus } from "./shell-menu-utils";

export function LocaleSwitcher({ active }: { active: LocaleCode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <details
      className="language-menu relative inline-block"
      data-shell-menu="language"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          closeOtherShellMenus(event.currentTarget);
        }
      }}
    >
      <summary aria-label="Languages" title="Languages" className="focus-ring action-secondary grid h-10 w-10 cursor-pointer list-none place-items-center text-[var(--muted)]">
        <Languages aria-hidden="true" size={17} />
      </summary>
      <div className="language-menu-panel panel grid gap-1 overflow-auto p-2 shadow-xl">
        {locales.map((locale) => (
          <Link
            key={locale}
            href={localizePath(currentPath, locale) as never}
            className={`language-option focus-ring rounded-md px-3 py-2 text-sm ${
              locale === active ? "is-active bg-[var(--accent)] font-bold text-black" : "text-[var(--muted)] hover:bg-[var(--surface-soft)]"
            }`}
          >
            <span>{localeNames[locale]}</span>
            {locale === active ? <Check aria-hidden="true" size={15} /> : null}
          </Link>
        ))}
      </div>
    </details>
  );
}
