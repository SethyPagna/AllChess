"use client";

import Link from "next/link";
import { Check, Languages } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { localeNames, locales, type LocaleCode } from "@/lib/i18n/locales";
import { localizePath } from "@/lib/i18n/navigation";
import { closeOtherShellMenus, useShellMenuDismissal } from "./menu-utils";

export function LocaleSwitcher({ active }: { active: LocaleCode }) {
  const menuRef = useShellMenuDismissal();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <details
      ref={menuRef}
      className="language-menu"
      data-shell-menu="language"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          closeOtherShellMenus(event.currentTarget);
        }
      }}
    >
      <summary aria-label="Languages" title="Languages" className="icon-btn shell-icon-control focus-ring">
        <Languages aria-hidden="true" size={16} />
      </summary>
      <div className="language-menu-panel popover">
        {locales.map((locale) => (
          <Link
            key={locale}
            href={localizePath(currentPath, locale) as never}
            className={`language-option focus-ring ${locale === active ? "is-active" : ""}`}
          >
            <span>{localeNames[locale]}</span>
            {locale === active ? <Check aria-hidden="true" size={15} /> : null}
          </Link>
        ))}
      </div>
    </details>
  );
}
