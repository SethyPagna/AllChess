import type { Metadata } from "next";
import Link from "next/link";

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
    ["lobby", t("nav.lobby")],
    ["variants", t("nav.variants")],
    ["history", t("nav.history")],
    ["settings", t("nav.settings")]
  ] as const;

  return (
    <html lang={locale} dir={rtlLocales.has(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
            <header className="glass sticky top-3 z-30 mb-6 flex flex-wrap items-center gap-3 rounded-lg px-4 py-3">
              <Link href={`/${locale}`} className="focus-ring mr-auto flex items-center gap-3 rounded-md">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--accent)] font-black text-black">
                  AC
                </span>
                <span>
                  <span className="block text-lg font-bold leading-tight">{t("app.name")}</span>
                  <span className="block text-xs text-[var(--muted)]">{t("app.tagline")}</span>
                </span>
              </Link>
              <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--muted)]">
                {nav.map(([href, label]) => (
                  <Link
                    key={href}
                    href={`/${locale}/${href}`}
                    className="focus-ring rounded-md px-3 py-2 transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <ThemeToggle
                labels={{
                  light: t("settings.light"),
                  dark: t("settings.dark"),
                  system: t("settings.system")
                }}
              />
              <Link
                href={`/${locale}/login`}
                className="focus-ring rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)]"
              >
                {t("nav.login")}
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
