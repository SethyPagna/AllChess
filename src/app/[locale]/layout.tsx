import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Crown, History, Menu, Play, Settings, UserRound } from "lucide-react";

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
  const nav = [
    ["lobby", t("nav.lobby"), Play],
    ["variants", t("nav.variants"), BookOpen],
    ["history", t("nav.history"), History],
    ["settings", t("nav.settings"), Settings]
  ] as const;

  return (
    <html lang={locale} dir={rtlLocales.has(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-3 py-3 sm:px-5 lg:px-6">
            <header className="glass sticky top-3 z-30 mb-5 flex items-center gap-3 rounded-lg px-3 py-2">
              <Link href={`/${locale}`} className="focus-ring mr-auto flex items-center gap-3 rounded-md">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--accent)] text-black">
                  <Crown size={22} strokeWidth={2.5} />
                </span>
                <span>
                  <span className="block text-lg font-bold leading-tight">{t("app.name")}</span>
                  <span className="hidden text-xs text-[var(--muted)] sm:block">{t("app.tagline")}</span>
                </span>
              </Link>
              <nav className="hidden items-center gap-1 text-sm text-[var(--muted)] md:flex">
                {nav.map(([href, label, Icon]) => (
                  <Link
                    key={href}
                    href={`/${locale}/${href}`}
                    className="focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ))}
              </nav>
              <details className="relative md:hidden">
                <summary className="focus-ring grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border border-[var(--border)]">
                  <Menu size={18} />
                </summary>
                <div className="panel absolute right-0 top-12 grid min-w-48 gap-1 p-2 shadow-xl">
                  {nav.map(([href, label, Icon]) => (
                    <Link key={href} href={`/${locale}/${href}`} className="focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                      <Icon size={16} />
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
              <ThemeToggle
                labels={{
                  light: t("settings.light"),
                  dark: t("settings.dark"),
                  system: t("settings.system")
                }}
              />
              <Link
                href={`/${locale}/login`}
                className="focus-ring action-secondary inline-flex h-10 items-center gap-2 px-3 text-sm"
              >
                <UserRound size={16} />
                <span className="hidden sm:inline">{t("nav.login")}</span>
              </Link>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="mt-10 space-y-3 border-t border-[var(--border)] py-6 text-sm text-[var(--muted)]">
              <LocaleSwitcher active={locale as LocaleCode} />
              <p>{t("app.description")}</p>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
