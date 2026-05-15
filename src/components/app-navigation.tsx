"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, Crown, Eye, History, Home, Library, LogIn, Settings, Swords, Trophy, UserRound, Users } from "lucide-react";
import type { ComponentType } from "react";

type AppIconKey =
  | "book"
  | "crown"
  | "eye"
  | "history"
  | "home"
  | "library"
  | "login"
  | "settings"
  | "swords"
  | "trophy"
  | "user"
  | "users";

export type AppNavLink = {
  href: string;
  icon: AppIconKey;
  label: string;
};

export type AppNavGroup = {
  icon: AppIconKey;
  label: string;
  links: AppNavLink[];
};

type AccountShortcut = {
  href: string;
  icon: "login" | "user";
  label: string;
};

type AppNavigationProps = {
  account?: AccountShortcut;
  groups: AppNavGroup[];
  locale: string;
};

const iconMap = {
  book: BookOpen,
  crown: Crown,
  eye: Eye,
  history: History,
  home: Home,
  library: Library,
  login: LogIn,
  settings: Settings,
  swords: Swords,
  trophy: Trophy,
  user: UserRound,
  users: Users
} satisfies Record<AppIconKey, ComponentType<{ size?: number; strokeWidth?: number }>>;

function normalizePath(path: string) {
  return path.split("?")[0]?.replace(/\/+$/, "") || "/";
}

function localizedHref(locale: string, href: string) {
  return `/${locale}/${href}`.replace(/\/+$/, "");
}

function hrefToRoute(locale: string, href: string) {
  return href.startsWith(`/${locale}/`) ? href.slice(locale.length + 2) : href;
}

function useActiveHref(locale: string) {
  const pathname = normalizePath(usePathname() || `/${locale}`);

  return (href: string) => {
    const target = normalizePath(localizedHref(locale, href));
    return pathname === target || (target !== `/${locale}` && pathname.startsWith(`${target}/`));
  };
}

function NavLink({ active, href, icon, label, nested = true }: AppNavLink & { active: boolean; nested?: boolean }) {
  const Icon = iconMap[icon];

  return (
    <Link
      href={href as never}
      aria-current={active ? "page" : undefined}
      className={`app-nav-link${nested ? " app-nav-sub-link" : ""} focus-ring${active ? " is-active" : ""}`}
    >
      <Icon size={18} strokeWidth={2.5} />
      <span>{label}</span>
    </Link>
  );
}

function AccountLink({ account, active, iconSize }: { account: AccountShortcut; active: boolean; iconSize: number }) {
  const Icon = iconMap[account.icon];

  return (
    <Link href={account.href as never} aria-current={active ? "page" : undefined} className={`app-nav-link focus-ring${active ? " is-active" : ""}`}>
      <Icon size={iconSize} strokeWidth={2.5} />
      <span>{account.label}</span>
    </Link>
  );
}

export function AppSidebarNavigation({ account, groups, locale }: AppNavigationProps) {
  const isActiveHref = useActiveHref(locale);
  const accountRoute = account ? hrefToRoute(locale, account.href) : "";

  return (
    <>
      <nav className="app-nav">
        {groups.map((group, index) => {
          const GroupIcon = iconMap[group.icon];
          const groupActive = group.links.some((link) => isActiveHref(link.href));

          return (
            <details key={group.label} className={`app-nav-group${groupActive ? " is-active" : ""}`} open={index < 3 || groupActive}>
              <summary className={`app-nav-group-summary focus-ring${groupActive ? " is-active" : ""}`}>
                <GroupIcon size={18} strokeWidth={2.5} />
                <span>{group.label}</span>
                <ChevronDown size={15} />
              </summary>
              <div>
                {group.links.map((link) => (
                  <NavLink key={link.href} {...link} href={localizedHref(locale, link.href)} active={isActiveHref(link.href)} />
                ))}
              </div>
            </details>
          );
        })}
      </nav>
      {account ? (
        <div className="app-sidebar-bottom" aria-label="Account shortcut">
          <AccountLink account={account} active={isActiveHref(accountRoute)} iconSize={20} />
        </div>
      ) : null}
    </>
  );
}

export function AppMobileNavigation({ account, groups, locale }: AppNavigationProps) {
  const isActiveHref = useActiveHref(locale);
  const accountRoute = account ? hrefToRoute(locale, account.href) : "";

  return (
    <div className="app-menu-sections">
      {groups.map((group) => (
        <section key={group.label} className="app-menu-section" aria-label={group.label}>
          <p className="app-menu-section-label">{group.label}</p>
          {group.links.map((link) => (
            <NavLink key={link.href} {...link} href={localizedHref(locale, link.href)} active={isActiveHref(link.href)} nested={false} />
          ))}
        </section>
      ))}
      {account ? (
        <section className="app-menu-section" aria-label="Account">
          <p className="app-menu-section-label">Account</p>
          <AccountLink account={account} active={isActiveHref(accountRoute)} iconSize={18} />
        </section>
      ) : null}
    </div>
  );
}
