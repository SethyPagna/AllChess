import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import LobbyPage from "@/app/[locale]/lobby/page";
import HistoryPage from "@/app/[locale]/history/page";
import PlaySetupPage from "@/app/[locale]/play/page";
import ProfilePage from "@/app/[locale]/profile/[username]/page";
import SettingsPage from "@/app/[locale]/settings/page";
import { ThemeProvider } from "@/components/theme-provider";

describe("compact page copy", () => {
  test("play setup uses info affordances instead of visible paragraph-heavy mode cards", async () => {
    const element = await PlaySetupPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('aria-label="More information"');
    expect(markup).toContain('aria-label="Play modes"');
    expect(markup).toContain("Mode");
    expect(markup).toContain("Game");
    expect(markup).toContain("Online");
    expect(markup).toContain("Bots");
    expect(markup).not.toContain("<p>Pick a mode first");
    expect(markup).not.toContain("play-mode-card");
  });

  test("lobby keeps section titles while moving details into hover/focus hints", async () => {
    const element = await LobbyPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Play Now");
    expect(markup).toContain("Learn by Family");
    expect(markup).toContain("Rooms &amp; Activity");
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

  test("account pages keep empty states concise", async () => {
    const history = await HistoryPage({ params: Promise.resolve({ locale: "en" }) });
    const profile = await ProfilePage({ params: Promise.resolve({ locale: "en", username: "player" }) });
    const markup = renderToStaticMarkup(
      <>
        {history}
        {profile}
      </>
    );

    expect(markup).toContain("No saved matches yet");
    expect(markup).toContain("No profile history yet");
    expect(markup).toContain('class="info-hint');
    expect(markup).toContain("Guest-ready");
    expect(markup).not.toContain("Finished games will appear here after Cloudflare D1 records");
    expect(markup).not.toContain("AllChess will show real per-game ratings");
  });
});
