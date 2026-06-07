import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Crown, Menu } from "lucide-react";

import { AppMobileNavigation, AppSidebarNavigation } from "@/components/shell/app-navigation";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { MobileAutoHideHeader } from "@/components/shell/mobile-auto-hide-header";
import { createAppNavGroups } from "@/components/shell/navigation-config";
import { NotificationCenter } from "@/components/shell/notification-center";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { ThemeToggle } from "@/components/shell/theme-toggle";
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

const boardPlanningScript = `
(() => {
  if (window.__allchessBoardPlanning) return;
  window.__allchessBoardPlanning = true;
  let origin = null;
  let activeBoard = null;
  function squareName(target) {
    return target instanceof Element ? target.closest("[data-square]")?.dataset.square ?? null : null;
  }
  function boardFor(target) {
    return target instanceof Element ? target.closest(".board-grid") : null;
  }
  function pointFor(board, square) {
    const cell = board?.querySelector('[data-square="' + CSS.escape(square) + '"]');
    if (!board || !cell) return null;
    const boardRect = board.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    return {
      x: ((cellRect.left + cellRect.width / 2 - boardRect.left) / boardRect.width) * 100,
      y: ((cellRect.top + cellRect.height / 2 - boardRect.top) / boardRect.height) * 100
    };
  }
  function clearArrows(board) {
    board?.querySelectorAll(".board-planning-layer [data-planning-arrow]").forEach((line) => line.remove());
  }
  function drawPreviewArrow(board, from, to) {
    const layer = board?.querySelector(".board-planning-layer");
    if (!layer || !from || !to || from === to) return;
    const start = pointFor(board, from);
    const end = pointFor(board, to);
    if (!start || !end) return;
    const line = layer.querySelector("[data-planning-preview]") ?? document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("data-planning-preview", "true");
    line.setAttribute("x1", String(start.x));
    line.setAttribute("y1", String(start.y));
    line.setAttribute("x2", String(end.x));
    line.setAttribute("y2", String(end.y));
    if (!line.parentNode) layer.appendChild(line);
  }
  function clearPreview(board) {
    board?.querySelectorAll(".board-planning-layer [data-planning-preview]").forEach((line) => line.remove());
  }
  document.addEventListener("mousedown", (event) => {
    if (event.button !== 2) return;
    origin = squareName(event.target);
    const board = boardFor(event.target);
    activeBoard = board;
    clearArrows(board);
    clearPreview(board);
  }, true);
  document.addEventListener("mousemove", (event) => {
    if (!origin || (event.buttons & 2) !== 2) return;
    drawPreviewArrow(activeBoard ?? boardFor(event.target), origin, squareName(event.target));
  }, true);
  document.addEventListener("mouseup", (event) => {
    if (event.button !== 2 || !origin) return;
    const board = activeBoard ?? boardFor(event.target);
    clearArrows(board);
    clearPreview(board);
    origin = null;
    activeBoard = null;
  }, true);
  document.addEventListener("contextmenu", (event) => {
    if (squareName(event.target)) event.preventDefault();
  }, true);
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: boardPlanningScript }} />
      </head>
      <body>
        <ThemeProvider>
          <div className="app-shell">
            <aside className="card app-sidebar" aria-label="Primary navigation">
              <Link href={`/${locale}`} className="btn btn-ghost app-brand focus-ring">
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
              <MobileAutoHideHeader>
                <Link href={`/${locale}`} className="btn btn-ghost app-mobile-brand focus-ring">
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
                <details className="dropdown app-menu">
                  <summary className="btn btn-square focus-ring action-secondary grid h-10 w-10 cursor-pointer list-none place-items-center" aria-label="Open navigation menu" title="Open navigation menu">
                    <Menu aria-hidden="true" size={18} />
                  </summary>
                  <div className="dropdown-content app-menu-panel">
                    <AppMobileNavigation account={{ href: profileHref, icon: "user", label: t("nav.profileHistory") }} auth={{ href: loginHref, icon: "login", label: t("nav.login") }} groups={navGroups} locale={locale} />
                  </div>
                </details>
              </MobileAutoHideHeader>
              <main className="app-content">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
