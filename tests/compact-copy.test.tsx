import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import LobbyPage from "@/app/[locale]/lobby/page";
import PlaySetupPage from "@/app/[locale]/play/page";
import SettingsPage from "@/app/[locale]/settings/page";
import { ThemeProvider } from "@/components/theme-provider";

describe("compact page copy", () => {
  test("play setup uses info affordances instead of visible paragraph-heavy mode cards", async () => {
    const element = await PlaySetupPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('aria-label="More information"');
    expect(markup).toContain("Play Online");
    expect(markup).not.toContain("<p>Pick a mode first");
  });

  test("lobby keeps section titles while moving details into hover/focus hints", async () => {
    const element = await LobbyPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Play Now");
    expect(markup).toContain("Game Families");
    expect(markup).toContain('class="info-hint');
    expect(markup).not.toContain("A Cloudflare-first arena for chess");
  });

  test("settings page keeps preference rows compact", async () => {
    const element = await SettingsPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(<ThemeProvider>{element}</ThemeProvider>);

    expect(markup).toContain("Display");
    expect(markup).toContain("Language");
    expect(markup).toContain("Notifications");
    expect(markup).toContain('class="info-hint');
    expect(markup).not.toContain("A multilingual multiplayer chess platform");
  });
});
