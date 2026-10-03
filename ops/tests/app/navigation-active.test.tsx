import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AppRailNavigation, AppTabBar, localizedHref } from "@/components/shell/app-navigation";
import { createAppNavItems, createAppSecondaryItems } from "@/components/shell/navigation-config";
import { createTranslator } from "@/lib/i18n/dictionary";

const route = vi.hoisted(() => ({ pathname: "/en" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname
}));

const t = createTranslator("en");
const items = createAppNavItems(t);
const secondary = createAppSecondaryItems(t);

function links(markup: string) {
  return [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, content]) => ({
    href: attributes.match(/href="([^"]*)"/)?.[1],
    classes: attributes.match(/class="([^"]*)"/)?.[1].split(" ") ?? [],
    current: attributes.match(/aria-current="([^"]*)"/)?.[1],
    text: content.replace(/<[^>]*>/g, "")
  }));
}

function activeLinks(markup: string) {
  return links(markup).filter((link) => link.current === "page").map((link) => link.text);
}

function renderRail(pathname: string, locale = "en") {
  route.pathname = pathname;
  return renderToStaticMarkup(createElement(AppRailNavigation, { items, secondary, locale }));
}

function renderTabBar(pathname: string, tools?: string) {
  route.pathname = pathname;
  return renderToStaticMarkup(createElement(AppTabBar, { items, secondary, locale: "en", moreLabel: t("nav.more"), tools }));
}

function moreSummaryClasses(markup: string) {
  return markup.match(/<summary\b[^>]*class="([^"]*)"[^>]*aria-label="More"/)?.[1].split(" ") ?? [];
}

beforeEach(() => {
  route.pathname = "/en";
});

describe("app navigation config", () => {
  test("builds the primary items with Games as the variants label", () => {
    expect(items.map((item) => [item.href, item.label])).toEqual([
      ["", "Home"],
      ["play", "Play"],
      ["variants", "Games"],
      ["watch", "Watch"],
      ["history", "History"]
    ]);
  });

  test("keeps account pages in the secondary group", () => {
    expect(secondary.map((item) => [item.href, item.label])).toEqual([
      ["leaderboards", "Leaderboards"],
      ["profile/player", "Profile"],
      ["settings", "Settings"]
    ]);
  });

  test("localizes hrefs without a trailing slash for home", () => {
    expect(localizedHref("en", "")).toBe("/en");
    expect(localizedHref("fr", "play")).toBe("/fr/play");
    expect(localizedHref("km", "profile/player")).toBe("/km/profile/player");
  });
});

describe("rail navigation", () => {
  test("renders main and account navs with localized hrefs", () => {
    const markup = renderRail("/en");

    expect(markup).toContain('aria-label="Main"');
    expect(markup).toContain('aria-label="Account"');
    expect(links(markup).map((link) => link.href)).toEqual([
      "/en",
      "/en/play",
      "/en/variants",
      "/en/watch",
      "/en/history",
      "/en/leaderboards",
      "/en/profile/player",
      "/en/settings"
    ]);
    expect(links(markup).every((link) => link.classes.includes("rail-link"))).toBe(true);
  });

  test.each([
    { pathname: "/en", active: "Home" },
    { pathname: "/en/", active: "Home" },
    { pathname: "/en/play", active: "Play" },
    { pathname: "/en/play/classic", active: "Play" },
    { pathname: "/en/variants", active: "Games" },
    { pathname: "/en/games/classic", active: "Games" },
    { pathname: "/en/watch/", active: "Watch" },
    { pathname: "/en/history", active: "History" },
    { pathname: "/en/leaderboards", active: "Leaderboards" },
    { pathname: "/en/profile/player", active: "Profile" },
    { pathname: "/en/settings", active: "Settings" }
  ])("marks only $active active on $pathname", ({ pathname, active }) => {
    const markup = renderRail(pathname);

    expect(activeLinks(markup)).toEqual([active]);
    expect(links(markup).filter((link) => link.classes.includes("is-active")).map((link) => link.text)).toEqual([active]);
  });

  test("does not treat home as a prefix of every route", () => {
    expect(activeLinks(renderRail("/en/play/classic"))).not.toContain("Home");
  });

  test("does not activate a link for a sibling route that only shares a prefix", () => {
    expect(activeLinks(renderRail("/en/playground"))).toEqual([]);
  });

  test("uses the locale for both hrefs and active matching", () => {
    const markup = renderRail("/km/watch", "km");

    expect(links(markup).every((link) => link.href?.startsWith("/km"))).toBe(true);
    expect(activeLinks(markup)).toEqual(["Watch"]);
    expect(activeLinks(renderRail("/en/watch", "km"))).toEqual([]);
  });
});

describe("tab bar navigation", () => {
  test("shows four tabs and moves the rest into the More sheet", () => {
    const markup = renderTabBar("/en");
    const tabs = links(markup).filter((link) => link.classes.includes("tab-link")).map((link) => link.text);
    const sheet = links(markup).filter((link) => link.classes.includes("sheet-link")).map((link) => link.text);

    expect(tabs).toEqual(["Home", "Play", "Games", "Watch"]);
    expect(sheet).toEqual(["History", "Leaderboards", "Profile", "Settings"]);
    expect(activeLinks(markup)).toEqual(["Home"]);
  });

  test("marks the active tab without highlighting More", () => {
    const markup = renderTabBar("/en/variants");

    expect(activeLinks(markup)).toEqual(["Games"]);
    expect(moreSummaryClasses(markup)).not.toContain("is-active");
  });

  test.each([
    { pathname: "/en/history", active: "History" },
    { pathname: "/en/settings", active: "Settings" },
    { pathname: "/en/profile/player", active: "Profile" }
  ])("highlights More when $active is open from the sheet", ({ pathname, active }) => {
    const markup = renderTabBar(pathname);

    expect(activeLinks(markup)).toEqual([active]);
    expect(links(markup).find((link) => link.current === "page")?.classes).toContain("sheet-link");
    expect(moreSummaryClasses(markup)).toContain("is-active");
  });

  test("marks Games on game guide pages", () => {
    expect(activeLinks(renderTabBar("/en/games/jungle"))).toEqual(["Games"]);
  });

  test("labels More from the dictionary and joins the shell menu group", () => {
    const markup = renderToStaticMarkup(createElement(AppTabBar, { items, secondary, locale: "km", moreLabel: createTranslator("km")("nav.more") }));

    expect(markup).toContain('data-shell-menu="more"');
    expect(markup).toMatch(/aria-label="ច្រើនទៀត"[^>]*>[\s\S]*<span>ច្រើនទៀត<\/span>/);
    expect(markup).not.toContain(">More<");
  });

  test("renders extra tools inside the More sheet only when provided", () => {
    expect(renderTabBar("/en", "Install")).toContain('<div class="sheet-tools">Install</div>');
    expect(renderTabBar("/en")).not.toContain("sheet-tools");
  });
});
