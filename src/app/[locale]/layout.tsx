import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, ChevronDown, Crown, Eye, History, Home, Library, LogIn, Menu, Settings, Swords, Trophy, UserRound, Users } from "lucide-react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { createTranslator } from "@/lib/i18n/dictionary";
import { locales, normalizeLocale, rtlLocales, type LocaleCode } from "@/lib/i18n/locales";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return {
    title: `${t("app.name")} - ${t("lobby.title")}`,
    description: t("app.description")
  };
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const navGroups = [
    {
      label: t("nav.play"),
      Icon: Swords,
      links: [
        ["lobby", t("nav.lobby"), Home],
        ["play/classic", "Classic", Swords],
        ["play/classic?bot=normal", "Bots", Users]
      ]
    },
    {
      label: t("nav.learn"),
      Icon: BookOpen,
      links: [
        ["variants", t("nav.variants"), Library],
        ["variants?playability=learn", "Rules", BookOpen]
      ]
    },
    {
      label: t("nav.watch"),
      Icon: Eye,
      links: [
        ["lobby?watch=live", "Watch live", Eye],
        ["leaderboards", t("nav.leaderboards"), Trophy]
      ]
    },
    {
      label: t("nav.community"),
      Icon: Users,
      links: [
        ["history", t("nav.history"), History],
        ["profile/player", t("nav.profile"), UserRound]
      ]
    },
    {
      label: t("nav.settings"),
      Icon: Settings,
      links: [["settings", t("nav.settings"), Settings]]
    }
  ] as const;
  const profileHref = `/${locale}/profile/player`;
  const loginHref = `/${locale}/login`;

  return (
    <html lang={locale} dir={rtlLocales.has(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="app-shell">
            <aside className="app-sidebar" aria-label="Primary navigation">
              <Link href={`/${locale}`} className="app-brand focus-ring">
                <span className="app-brand-mark">
                  <Crown size={22} strokeWidth={2.7} />
                </span>
                <span>
                  <span className="app-brand-name">{t("app.name")}</span>
                  <span className="app-brand-tagline">{t("app.tagline")}</span>
                </span>
              </Link>
              <nav className="app-nav">
                {navGroups.map(({ label, Icon, links }, index) => (
                  <details key={label} className="app-nav-group" open={index < 3}>
                    <summary className="app-nav-group-summary focus-ring">
                      <Icon size={18} strokeWidth={2.5} />
                      <span>{label}</span>
                      <ChevronDown size={15} />
                    </summary>
                    <div>
                      {links.map(([href, itemLabel, ItemIcon]) => (
                        <Link key={href} href={`/${locale}/${href}` as never} className="app-nav-link app-nav-sub-link focus-ring">
                          <ItemIcon size={18} strokeWidth={2.5} />
                          <span>{itemLabel}</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                ))}
              </nav>
              <div className="app-sidebar-bottom">
                <Link href={loginHref as never} className="app-nav-link focus-ring">
                  <LogIn size={20} strokeWidth={2.5} />
                  <span>{t("nav.login")}</span>
                </Link>
              </div>
            </aside>
            <div className="app-main">
              <header className="app-mobile-header">
                <Link href={`/${locale}`} className="app-mobile-brand focus-ring">
                  <span className="app-brand-mark">
                    <Crown size={20} strokeWidth={2.7} />
                  </span>
                  <span>{t("app.name")}</span>
                </Link>
                <details className="app-menu">
                  <summary className="focus-ring grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border border-[var(--border)]">
                    <Menu size={18} />
                  </summary>
                  <div className="app-menu-panel">
                    {navGroups.flatMap((group) => [...group.links]).map(([href, label, Icon]) => (
                      <Link key={href} href={`/${locale}/${href}` as never} className="app-nav-link focus-ring">
                        <Icon size={18} />
                        <span>{label}</span>
                      </Link>
                    ))}
                    <Link href={profileHref as never} className="app-nav-link focus-ring">
                      <UserRound size={18} />
                      <span>{t("nav.profile")}</span>
                    </Link>
                    <Link href={loginHref as never} className="app-nav-link focus-ring">
                      <LogIn size={18} />
                      <span>{t("nav.login")}</span>
                    </Link>
                  </div>
                </details>
              </header>
              <div className="app-universal-tools">
                <ThemeToggle
                  labels={{
                    light: t("settings.light"),
                    dark: t("settings.dark"),
                    system: t("settings.system")
                  }}
                />
                <Suspense fallback={<span className="action-secondary inline-flex h-10 items-center px-3 text-sm">{locale.toUpperCase()}</span>}>
                  <LocaleSwitcher active={locale as LocaleCode} />
                </Suspense>
              </div>
              <main className="app-content">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
