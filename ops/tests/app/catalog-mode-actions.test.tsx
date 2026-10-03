import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CatalogBrowser, CatalogInfoOverlay } from "@/components/catalog/catalog-browser";
import { GameDetailHero } from "@/components/games/game-detail-hero";
import { getGameCatalogEntry, type CatalogPlayMode, type GameCatalogEntry } from "@/lib/catalog";

function entry(key: string) {
  const value = getGameCatalogEntry(key);
  if (!value) throw new Error(`Missing catalog fixture: ${key}`);
  return value;
}

function links(markup: string, className?: string) {
  return [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, content]) => ({
    href: attributes.match(/href="([^"]*)"/)?.[1].replaceAll("&amp;", "&"),
    classes: attributes.match(/class="([^"]*)"/)?.[1].split(" ") ?? [],
    label: attributes.match(/aria-label="([^"]*)"/)?.[1],
    text: content.replace(/<[^>]*>/g, "")
  })).filter(link => !className || link.classes.includes(className));
}

function hero(value: GameCatalogEntry, mode: CatalogPlayMode | "all", locale = "en") {
  return renderToStaticMarkup(<GameDetailHero entry={value} locale={locale} mode={mode === "all" ? undefined : mode} />);
}

const modes: Array<{ mode: CatalogPlayMode | "all"; card: string; href: string; label: string }> = [
  { mode: "all", card: "/en/games/classic", href: "/en/play/classic?mode=offline&time=rapid", label: "Play" },
  { mode: "offline", card: "/en/games/classic?mode=offline", href: "/en/play/classic?mode=offline&time=rapid", label: "Play" },
  { mode: "bot", card: "/en/games/classic?mode=bot", href: "/en/play/classic?bot=normal&mode=bot&time=rapid", label: "Play a bot" },
  { mode: "online", card: "/en/games/classic?mode=online", href: "/en/play/classic?mode=online&time=rapid", label: "Find match" },
  { mode: "room", card: "/en/games/classic?mode=room", href: "/en/play/classic?mode=room&time=rapid", label: "Create room" },
  { mode: "spectate", card: "/en/games/classic?mode=spectate", href: "/en/watch?variant=classic", label: "Watch" }
];

describe("catalog mode actions", () => {
  test.each(modes)("$mode card opens the game page, whose primary action keeps the chosen flow", ({ mode, card, href, label }) => {
    const classic = entry("classic");
    const markup = renderToStaticMarkup(<CatalogBrowser entries={[classic]} initialMode={mode} locale="en" />);
    expect(links(markup)).toHaveLength(1);
    expect(links(markup, "catalog-art-link").map(link => link.href)).toEqual([card]);
    expect(markup).not.toContain("Open guide for");
    expect(markup).not.toContain("catalog-card-guide");

    const detail = hero(classic, mode);
    const primary = links(detail, "action-primary");
    expect(primary.map(link => link.href)).toEqual([href]);
    expect(primary[0].text).toBe(label);
    expect(links(detail)).toHaveLength(2);
    expect(links(detail).filter(link => link.href === href)).toHaveLength(1);
  });

  test("the guide overlay kept for the play picker still follows the chosen mode", () => {
    const classic = entry("classic");
    for (const [mode, href] of [["all", "/en/play/classic?mode=offline&time=rapid"], ["online", "/en/play/classic?mode=online&time=rapid"], ["spectate", "/en/watch?variant=classic"]] as const) {
      const guide = renderToStaticMarkup(<CatalogInfoOverlay entry={classic} locale="en" mode={mode} onClose={() => undefined} />);
      expect(links(guide, "action-primary").map(link => link.href)).toEqual([href]);
      expect(links(guide).some(link => link.href === "/en/games/classic")).toBe(true);
    }
    const markup = renderToStaticMarkup(<CatalogInfoOverlay entry={classic} locale="en" onClose={() => undefined} />);
    expect(links(markup, "action-secondary").map(link => link.href)).toContain("/en/play/classic?bot=normal&mode=bot&time=rapid");
  });

  test("preview games keep local and bot access without unlocking online or friend play", () => {
    const preview = entry("ouk-chaktrang");
    for (const mode of ["all", "offline", "bot"] as const) {
      const markup = renderToStaticMarkup(<CatalogBrowser entries={[preview]} initialMode={mode} locale="en" />);
      expect(links(markup, "catalog-art-link")).toHaveLength(1);
      expect(markup).toContain(">Preview</span>");
    }
    for (const mode of ["online", "room"] as const) {
      const card = renderToStaticMarkup(<CatalogBrowser entries={[preview]} initialMode={mode} locale="en" />);
      expect(card).toContain("No matching games");
      expect(links(card)).toEqual([]);
      const detail = hero(preview, mode);
      expect(links(detail, "action-primary").map(link => link.href)).toEqual(["/en/play/ouk-chaktrang?mode=offline&time=rapid"]);
      expect(links(detail).some(link => link.href?.includes(`mode=${mode}`))).toBe(false);
    }
  });

  test("a game without a bot engine cannot acquire a bot action", () => {
    const noBot: GameCatalogEntry = { ...entry("classic"), botAdapter: "none" };
    const card = renderToStaticMarkup(<CatalogBrowser entries={[noBot]} initialMode="bot" locale="en" />);
    expect(card).toContain("No matching games");
    const detail = hero(noBot, "bot");
    expect(links(detail).some(link => link.href?.includes("mode=bot"))).toBe(false);
    expect(links(detail).map(link => link.text)).toEqual(["Play"]);
  });

  test("guide-only games sit in the rules-only list and keep permitted public room browsing", () => {
    const guideOnly = entry("go-19x19");
    expect(guideOnly.variantKey).toBeUndefined();
    const all = renderToStaticMarkup(<CatalogBrowser entries={[guideOnly]} locale="en" />);
    expect(links(all, "catalog-art-link")).toEqual([]);
    expect(links(all).map(link => link.href)).toEqual(["/en/games/go-19x19"]);
    expect(all).toMatch(/<details class="catalog-more-games" open="">/);
    expect(all).toContain("Rules only");
    expect(hero(guideOnly, "all")).not.toContain("<a ");

    const watch = renderToStaticMarkup(<CatalogBrowser entries={[guideOnly]} initialMode="spectate" locale="en" />);
    expect(links(watch).map(link => link.href)).toEqual(["/en/games/go-19x19?mode=spectate"]);
    const detail = hero(guideOnly, "spectate");
    expect(links(detail, "action-primary")).toMatchObject([{ href: "/en/watch", text: "Watch" }]);
    expect(links(detail).some(link => link.href?.includes("/play/"))).toBe(false);
  });

  test("board games lead and the rules-only list stays collapsed unless asked for", () => {
    const entries = [entry("go-19x19"), entry("classic")];
    const markup = renderToStaticMarkup(<CatalogBrowser entries={entries} locale="en" />);
    expect(markup.indexOf("/en/games/classic")).toBeLessThan(markup.indexOf("/en/games/go-19x19"));
    expect(markup).toMatch(/<details class="catalog-more-games">/);
    expect(markup).not.toContain("Status filter");
    const learn = renderToStaticMarkup(<CatalogBrowser entries={entries} initialStatus="learn" locale="en" />);
    expect(learn).toMatch(/<details class="catalog-more-games" open="">/);
    expect(links(learn).map(link => link.href)).toEqual(["/en/games/classic", "/en/games/go-19x19"]);
  });

  test("mode routing preserves the game, locale and family filter", () => {
    const markup = renderToStaticMarkup(<CatalogBrowser entries={[entry("classic"), entry("shogi"), entry("ouk-chaktrang")]} initialFamily="asian-chess" initialMode="bot" locale="km" />);
    expect(links(markup, "catalog-art-link").map(link => link.href)).toEqual(["/km/games/shogi?mode=bot", "/km/games/ouk-chaktrang?mode=bot"]);
    expect(markup).toContain('aria-pressed="true">Asian</button>');
    expect(links(hero(entry("shogi"), "bot", "km"), "action-primary")[0].href).toBe("/km/play/shogi?bot=normal&mode=bot&time=rapid");
    const watch = renderToStaticMarkup(<CatalogBrowser entries={[entry("xiangqi")]} initialMode="spectate" locale="km" />);
    expect(links(watch, "catalog-art-link")[0].href).toBe("/km/games/xiangqi?mode=spectate");
    expect(links(hero(entry("xiangqi"), "spectate", "km"), "action-primary")[0].href).toBe("/km/watch?variant=xiangqi");
  });
});
