import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CatalogBrowser, CatalogInfoOverlay } from "@/components/catalog/catalog-browser";
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

const modes: Array<{ mode: CatalogPlayMode | "all"; href: string; label: string }> = [
  { mode: "all", href: "/en/play/classic?mode=offline&time=rapid", label: "Play local" },
  { mode: "offline", href: "/en/play/classic?mode=offline&time=rapid", label: "Play local" },
  { mode: "bot", href: "/en/play/classic?bot=normal&mode=bot&time=rapid", label: "Play bot" },
  { mode: "online", href: "/en/play/classic?mode=online&time=rapid", label: "Find match" },
  { mode: "room", href: "/en/play/classic?mode=room&time=rapid", label: "Play friend" },
  { mode: "spectate", href: "/en/watch?variant=classic", label: "Watch" }
];

describe("catalog mode actions", () => {
  test.each(modes)("$mode keeps artwork, card and guide actions in the chosen flow", ({ mode, href, label }) => {
    const classic = entry("classic");
    const card = renderToStaticMarkup(<CatalogBrowser entries={[classic]} initialMode={mode} locale="en" />);
    const guide = renderToStaticMarkup(<CatalogInfoOverlay entry={classic} locale="en" mode={mode} onClose={() => undefined} />);
    const artwork = links(card, "catalog-art-link");
    const primary = links(card, "action-primary");
    const guidePrimary = links(guide, "action-primary");
    expect(artwork.map(link => link.href)).toEqual([href]);
    expect(primary.map(link => link.href)).toEqual([href]);
    expect(guidePrimary.map(link => link.href)).toEqual([href]);
    expect(primary[0].text).toBe(label);
    expect(guidePrimary[0].text).toBe(label);
    expect(primary[0].label).toContain("Classic Chess");
    expect(artwork[0].label).toBe(primary[0].label);
    expect(guidePrimary[0].label).toBe(primary[0].label);
    if (mode === "bot") expect(links(guide).filter(link => link.href === href)).toHaveLength(1);
  });

  test("existing guide callers retain local play and a separate bot choice", () => {
    const markup = renderToStaticMarkup(<CatalogInfoOverlay entry={entry("classic")} locale="en" onClose={() => undefined} />);
    expect(links(markup, "action-primary")[0].href).toBe("/en/play/classic?mode=offline&time=rapid");
    expect(links(markup, "action-secondary").map(link => link.href)).toContain("/en/play/classic?bot=normal&mode=bot&time=rapid");
  });

  test("preview games keep local and bot access without unlocking online or friend play", () => {
    const preview = entry("ouk-chaktrang");
    for (const mode of ["all", "offline", "bot"] as const) {
      const markup = renderToStaticMarkup(<CatalogBrowser entries={[preview]} initialMode={mode} locale="en" />);
      expect(links(markup, "action-primary")).toHaveLength(1);
      expect(markup).toContain("Preview");
    }
    for (const mode of ["online", "room"] as const) {
      const card = renderToStaticMarkup(<CatalogBrowser entries={[preview]} initialMode={mode} locale="en" />);
      const guide = renderToStaticMarkup(<CatalogInfoOverlay entry={preview} mode={mode} locale="en" onClose={() => undefined} />);
      expect(card).toContain("No matching games");
      expect(links(card, "catalog-art-link")).toEqual([]);
      expect(links(guide, "action-primary")).toEqual([]);
      expect(links(guide).some(link => link.href?.includes(`mode=${mode}`))).toBe(false);
    }
  });

  test("a game without a bot engine cannot acquire a bot action", () => {
    const noBot: GameCatalogEntry = { ...entry("classic"), botAdapter: "none" };
    const card = renderToStaticMarkup(<CatalogBrowser entries={[noBot]} initialMode="bot" locale="en" />);
    const guide = renderToStaticMarkup(<CatalogInfoOverlay entry={noBot} mode="bot" locale="en" onClose={() => undefined} />);
    expect(card).toContain("No matching games");
    expect(links(guide).some(link => link.href?.includes("mode=bot"))).toBe(false);
    expect(links(guide, "action-primary")).toEqual([]);
  });

  test("guide-only games have no invented board destination and retain permitted public room browsing", () => {
    const guideOnly = entry("go-19x19");
    expect(guideOnly.variantKey).toBeUndefined();
    const all = renderToStaticMarkup(<CatalogBrowser entries={[guideOnly]} locale="en" />);
    expect(all).toMatch(/<button[^>]+aria-label="Read Go[^"]+ guide"/);
    expect(links(all)).toEqual([]);
    const watch = renderToStaticMarkup(<CatalogBrowser entries={[guideOnly]} initialMode="spectate" locale="en" />);
    expect(links(watch, "action-primary")).toMatchObject([{ href: "/en/watch", label: "Browse public rooms", text: "Watch" }]);
    const guide = renderToStaticMarkup(<CatalogInfoOverlay entry={guideOnly} mode="spectate" locale="en" onClose={() => undefined} />);
    expect(links(guide, "action-primary")[0].href).toBe("/en/watch");
    expect(links(guide).some(link => link.href?.includes("/play/"))).toBe(false);
    expect(links(guide).some(link => link.href === "/en/games/go-19x19")).toBe(true);
  });

  test("mode routing preserves the game, locale and combined family/status filters", () => {
    const markup = renderToStaticMarkup(<CatalogBrowser entries={[entry("classic"), entry("shogi"), entry("ouk-chaktrang")]} initialFamily="asian-chess" initialStatus="playable" initialMode="bot" locale="km" />);
    expect(links(markup, "catalog-art-link").map(link => link.href)).toEqual(["/km/play/shogi?bot=normal&mode=bot&time=rapid"]);
    const watch = renderToStaticMarkup(<CatalogBrowser entries={[entry("xiangqi")]} initialMode="spectate" locale="km" />);
    expect(links(watch, "catalog-art-link")[0].href).toBe("/km/watch?variant=xiangqi");
  });
});
