import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import HistoryPage from "@/app/[locale]/history/page";
import LeaderboardsPage from "@/app/[locale]/leaderboards/page";
import LobbyPage from "@/app/[locale]/lobby/page";
import LoginPage from "@/app/[locale]/login/page";
import PlaySetupPage from "@/app/[locale]/play/page";
import ProfilePage from "@/app/[locale]/profile/[username]/page";
import SettingsPage from "@/app/[locale]/settings/page";
import VariantsPage from "@/app/[locale]/variants/page";
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
    expect(markup).toContain("Games &amp; Rules");
    expect(markup).toContain("Rooms &amp; Activity");
    expect(markup).toContain('class="info-hint');
    expect(markup).not.toContain("A Cloudflare-first arena for chess");
  });

  test("games and rules owns bot training, rules, and training status", async () => {
    const element = await VariantsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Games &amp; rules");
    expect(markup).toContain("Bot training status");
    expect(markup).toContain("Book &amp; tactics");
    expect(markup).toContain("Open guide for Classic Chess");
    expect(markup).toContain("Games &amp; rules");
    expect(markup).not.toContain("Full Guide");
  });

  test("history is its own compact records page", async () => {
    const element = await HistoryPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Match records");
    expect(markup).toContain("No saved matches yet");
    expect(markup).toContain("Saved games, review links, and rating changes");
    expect(markup).toContain("Search unlocks after saved matches");
    expect(markup).toContain("aria-disabled=\"true\"");
    expect(markup).not.toContain("redirect");
  });

  test("leaderboards are honest while rated results are empty", async () => {
    const element = await LeaderboardsPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Leaderboards");
    expect(markup).toContain("No rated results yet.");
    expect(markup).toContain("aria-label=\"Leaderboard filters\"");
    expect(markup).toContain("aria-disabled=\"true\"");
    expect(markup).toContain("Leaderboards stay empty until real games are recorded.");
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
    const profile = await ProfilePage({ params: Promise.resolve({ locale: "en", username: "player" }) });
    const markup = renderToStaticMarkup(profile);

    expect(markup).toContain("Profile &amp; history");
    expect(markup).toContain("No profile history yet");
    expect(markup).toContain('class="info-hint');
    expect(markup).toContain("Guest-ready");
    expect(markup).not.toContain("Finished games will appear here after Cloudflare D1 records");
    expect(markup).not.toContain("AllChess will show real per-game ratings");
  });

  test("login keeps account benefits compact", async () => {
    const element = await LoginPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Ratings");
    expect(markup).toContain("Reviews");
    expect(markup).toContain("Preferences");
    expect(markup).toContain('class="info-hint');
    expect(markup).not.toContain("<p>Sign in with AllChess auth");
  });
});
