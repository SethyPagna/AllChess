import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import AnalysisPage from "@/app/[locale]/analysis/[gameId]/page";
import GameDetailPage from "@/app/[locale]/games/[gameId]/page";
import HistoryPage from "@/app/[locale]/history/page";
import LeaderboardsPage from "@/app/[locale]/leaderboards/page";
import LobbyPage from "@/app/[locale]/lobby/page";
import LoginPage from "@/app/[locale]/login/page";
import PlayPage from "@/app/[locale]/play/[gameId]/page";
import PlaySetupPage from "@/app/[locale]/play/page";
import ProfilePage from "@/app/[locale]/profile/[username]/page";
import SettingsPage from "@/app/[locale]/settings/page";
import VariantsPage from "@/app/[locale]/variants/page";
import WatchPage from "@/app/[locale]/watch/page";
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

  test("game detail route safely resolves aliases and malformed ids", async () => {
    const element = await GameDetailPage({ params: Promise.resolve({ locale: "en", gameId: "dou-shou-qi" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Jungle");
    expect(markup).toContain("Guide gated for play");
    await expect(GameDetailPage({ params: Promise.resolve({ locale: "en", gameId: "%E0%A4%A" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  test("play route safely decodes game ids before loading the board", async () => {
    const element = await PlayPage({
      params: Promise.resolve({ locale: "en", gameId: "classic" }),
      searchParams: Promise.resolve({ mode: "bot", bot: "grandmaster", time: "blitz" })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Classic Chess");
    expect(markup).toContain("Bot Mode");
    expect(markup).toContain("Bot difficulty");
    expect(markup).toContain('<option value="grandmaster" selected="">Grandmaster</option>');
    expect(markup).toContain("Blitz 5+0");
    await expect(PlayPage({ params: Promise.resolve({ locale: "en", gameId: "%E0%A4%A" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
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

  test("watch rooms disables live controls until room data exists", async () => {
    const element = await WatchPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Watch rooms");
    expect(markup).toContain("No public rooms right now");
    expect(markup).toContain("aria-label=\"Watch room controls\"");
    expect(markup).toContain("Search unlocks when public rooms are available.");
    expect(markup).toContain("disabled=\"\"");
  });

  test("analysis keeps empty review controls visible but disabled", async () => {
    const element = await AnalysisPage({ params: Promise.resolve({ locale: "en", gameId: "demo" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Review tools");
    expect(markup).toContain("aria-label=\"Review playback controls\"");
    expect(markup).toContain("First move unlocks when this game has saved move history.");
    expect(markup).toContain("Playback controls unlock after saved moves");
    expect(markup).toContain("disabled=\"\"");
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

  test("login explains auth redirects without exposing secrets", async () => {
    const element = await LoginPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ error: "google-oauth-not-configured" })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain("Google sign-in is not configured yet.");
    expect(markup).toContain("Use email/password or continue as guest.");
    expect(markup).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(markup).not.toContain("CLOUDFLARE");
  });

  test("login shows the sanitized generic auth error", async () => {
    const element = await LoginPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ error: "auth-error" })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("We could not complete sign-in.");
    expect(markup).toContain("continue as guest");
    expect(markup).not.toContain("<script>bad()</script>");
  });

  test("login explains duplicate account redirects with a stable code", async () => {
    const element = await LoginPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ error: "account-exists" })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("An account already exists for this email.");
    expect(markup).toContain("Sign in instead");
    expect(markup).not.toContain("password_hash");
  });
});
