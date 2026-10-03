import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Crown } from "lucide-react";

import { AppRailNavigation, AppTabBar } from "@/components/shell/app-navigation";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { MobileAutoHideHeader } from "@/components/shell/mobile-auto-hide-header";
import { createAppNavItems, createAppSecondaryItems } from "@/components/shell/navigation-config";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { OfflinePack } from "@/components/shell/offline-pack";
import { InstallApp } from "@/components/shell/install-app";
import { createTranslator } from "@/lib/i18n/dictionary";
import { locales, normalizeLocale, rtlLocales, type LocaleCode } from "@/lib/i18n/locales";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const themeInitScript = `
(() => {
  try {
    const key = "allchess-theme";
    const stored = window.localStorage.getItem(key);
    const choice = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const resolved = choice === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  } catch {
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return {
    title: t("app.name"),
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
  const items = createAppNavItems(t);
  const secondary = createAppSecondaryItems(t);
  const themeLabels = { light: t("settings.light"), dark: t("settings.dark"), system: t("settings.system") };
  const quickTools = (
    <>
      <ThemeToggle labels={themeLabels} />
      <Suspense fallback={<span className="icon-btn shell-icon-control" aria-hidden="true" />}>
        <LocaleSwitcher active={locale as LocaleCode} />
      </Suspense>
    </>
  );
  const brand = (
    <>
      <span className="brand-mark"><Crown size={16} strokeWidth={2.4} /></span>
      <span className="brand-name">{t("app.name")}</span>
    </>
  );

  return (
    <html lang={locale} dir={rtlLocales.has(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <div className="shell">
            <aside className="rail" aria-label="Primary navigation">
              <Link href={`/${locale}`} className="rail-brand focus-ring">{brand}</Link>
              <AppRailNavigation items={items} secondary={secondary} locale={locale} />
              <div className="rail-tools" role="group" aria-label="Quick settings">
                {quickTools}
                <InstallApp />
                <OfflinePack />
              </div>
            </aside>
            <div className="shell-main">
              <MobileAutoHideHeader>
                <Link href={`/${locale}`} className="topbar-brand focus-ring">{brand}</Link>
                <div className="topbar-tools" role="group" aria-label="Quick settings">{quickTools}</div>
              </MobileAutoHideHeader>
              <main className="app-content">{children}</main>
              <AppTabBar items={items} secondary={secondary} locale={locale} moreLabel={t("nav.more")} tools={<><InstallApp /><OfflinePack /></>} />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
