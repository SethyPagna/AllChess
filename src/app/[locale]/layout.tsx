import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Crown, Menu } from "lucide-react";

import { AppMobileNavigation, AppSidebarNavigation } from "@/components/shell/app-navigation";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { createAppNavGroups } from "@/components/shell/navigation-config";
import { NotificationCenter } from "@/components/shell/notification-center";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { ThemeToggle } from "@/components/shell/theme-toggle";
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
  const navGroups = createAppNavGroups(t);
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
                </span>
              </Link>
              <AppSidebarNavigation account={{ href: profileHref, icon: "user", label: t("nav.profileHistory") }} auth={{ href: loginHref, icon: "login", label: t("nav.login") }} groups={navGroups} locale={locale} />
              <div className="app-responsive-tools" aria-label="Quick settings">
                <ThemeToggle
                  labels={{
                    light: t("settings.light"),
                    dark: t("settings.dark"),
                    system: t("settings.system")
                  }}
                />
                <Suspense fallback={<span className="action-secondary grid h-10 w-10 place-items-center text-sm">...</span>}>
                  <LocaleSwitcher active={locale as LocaleCode} />
                </Suspense>
                <NotificationCenter />
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
                <div className="app-mobile-tools" aria-label="Quick settings">
                  <ThemeToggle
                    labels={{
                      light: t("settings.light"),
                      dark: t("settings.dark"),
                      system: t("settings.system")
                    }}
                  />
                  <Suspense fallback={<span className="action-secondary grid h-10 w-10 place-items-center text-sm">...</span>}>
                    <LocaleSwitcher active={locale as LocaleCode} />
                  </Suspense>
                  <NotificationCenter />
                </div>
                <details className="app-menu">
                  <summary className="focus-ring grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border border-[var(--border)]">
                    <Menu size={18} />
                  </summary>
                  <div className="app-menu-panel">
                    <AppMobileNavigation account={{ href: profileHref, icon: "user", label: t("nav.profileHistory") }} auth={{ href: loginHref, icon: "login", label: t("nav.login") }} groups={navGroups} locale={locale} />
                  </div>
                </details>
              </header>
              <main className="app-content">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
