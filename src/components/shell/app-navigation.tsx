"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ComponentType, type ReactNode } from "react";
import { BookOpen, Eye, History, Home, Library, LogIn, MoreHorizontal, Settings, Swords, Trophy, UserRound } from "lucide-react";

import { closeOtherShellMenus, useShellMenuDismissal } from "./menu-utils";

type AppIconKey = "book" | "eye" | "history" | "home" | "library" | "login" | "settings" | "swords" | "trophy" | "user";

export type AppNavItem = {
  href: string;
  icon: AppIconKey;
  label: string;
  /** Other route sections that belong to this item, such as game guides under Games. */
  alsoActiveOn?: string[];
};

type AppNavigationProps = {
  items: AppNavItem[];
  secondary: AppNavItem[];
  locale: string;
};

const iconMap = {
  book: BookOpen,
  eye: Eye,
  history: History,
  home: Home,
  library: Library,
  login: LogIn,
  settings: Settings,
  swords: Swords,
  trophy: Trophy,
  user: UserRound
} satisfies Record<AppIconKey, ComponentType<{ size?: number; strokeWidth?: number }>>;

function normalizePath(path: string) {
  return path.split("?")[0]?.replace(/\/+$/, "") || "/";
}

export function localizedHref(locale: string, href: string) {
  return `/${locale}/${href}`.replace(/\/+$/, "");
}

function useActiveItem(locale: string) {
  const pathname = normalizePath(usePathname() || `/${locale}`);
  const matches = (href: string) => {
    const target = normalizePath(localizedHref(locale, href));
    return pathname === target || (target !== `/${locale}` && pathname.startsWith(`${target}/`));
  };

  return (item: AppNavItem) => matches(item.href) || Boolean(item.alsoActiveOn?.some(matches));
}

function NavItem({ item, locale, active, className, onClick }: { item: AppNavItem; locale: string; active: boolean; className: string; onClick?: () => void }) {
  const Icon = iconMap[item.icon];
  return (
    <Link href={localizedHref(locale, item.href) as never} aria-current={active ? "page" : undefined} className={`${className} focus-ring${active ? " is-active" : ""}`} onClick={onClick}>
      <Icon size={18} strokeWidth={2} />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppRailNavigation({ items, secondary, locale }: AppNavigationProps) {
  const isActive = useActiveItem(locale);
  return (
    <>
      <nav className="rail-nav" aria-label="Main">
        {items.map((item) => <NavItem key={item.href} item={item} locale={locale} active={isActive(item)} className="rail-link" />)}
      </nav>
      <nav className="rail-nav rail-nav-secondary" aria-label="Account">
        {secondary.map((item) => <NavItem key={item.href} item={item} locale={locale} active={isActive(item)} className="rail-link" />)}
      </nav>
    </>
  );
}

export function AppTabBar({ items, secondary, locale, moreLabel, tools }: AppNavigationProps & { moreLabel: string; tools?: ReactNode }) {
  const isActive = useActiveItem(locale);
  const pathname = usePathname();
  const moreRef = useShellMenuDismissal(".offline-pack-panel");
  const tabs = items.slice(0, 4);
  const overflow = [...items.slice(4), ...secondary];
  const moreActive = overflow.some(isActive);

  useEffect(() => {
    if (moreRef.current) moreRef.current.open = false;
  }, [moreRef, pathname]);

  function closeSheet(returnFocus: boolean) {
    const menu = moreRef.current;
    if (!menu) return;
    menu.open = false;
    if (returnFocus) menu.querySelector("summary")?.focus();
  }

  return (
    <nav className="tab-bar" aria-label="Main">
      {tabs.map((item) => <NavItem key={item.href} item={item} locale={locale} active={isActive(item)} className="tab-link" />)}
      <details
        ref={moreRef}
        className="tab-more"
        data-shell-menu="more"
        onToggle={(event) => {
          if (event.currentTarget.open) closeOtherShellMenus(event.currentTarget);
        }}
      >
        <summary className={`tab-link focus-ring${moreActive ? " is-active" : ""}`} aria-label={moreLabel}>
          <MoreHorizontal size={18} strokeWidth={2} />
          <span>{moreLabel}</span>
        </summary>
        <div className="tab-sheet">
          {overflow.map((item) => {
            const active = isActive(item);
            return <NavItem key={item.href} item={item} locale={locale} active={active} className="sheet-link" onClick={() => closeSheet(active)} />;
          })}
          {tools ? <div className="sheet-tools">{tools}</div> : null}
        </div>
      </details>
    </nav>
  );
}
