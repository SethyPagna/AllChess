import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import AnalysisPage from "@/app/[locale]/analysis/[gameId]/page";
import HomePage from "@/app/[locale]/page";
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
import { CatalogInfoOverlay } from "@/components/catalog/catalog-browser";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { getGameCatalogEntry } from "@/lib/catalog";

describe("compact page copy", () => {
  test("intro shortcuts open real play flows with mode and clock", async () => {
    const element = await HomePage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("/en/play?mode=online&amp;time=rapid");
    expect(markup).toContain("/en/play?mode=bot&amp;time=rapid");
    expect(markup).not.toContain('href="/en/watch"');
  });

  test("home keeps one primary action and a read-only game shelf", async () => {
    const element = await HomePage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Quick match");
    expect(markup).toContain("Play a bot");
    expect(markup).not.toContain("Watch live");
    expect(markup.match(/class="focus-ring action-primary"/g)).toHaveLength(1);
    expect(markup).toMatch(/href="\/en\/variants"[^>]*>All games<\/a>/);
    expect(markup.match(/class="library-card"/g)).toHaveLength(8);
    for (const removed of ["Filter game library", "Search game library", "library-favorite", "Show all"]) expect(markup).not.toContain(removed);
    expect(markup).toContain('aria-label="Classic chess board preview"');
  });

  test("play setup opens the board-first setup flow", async () => {
    const element = await PlaySetupPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ mode: "bot", time: "blitz" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Classic Chess");
    expect(markup).not.toContain("Choose setup first");
    expect(markup).toContain('aria-label="Play modes"');
    for (const mode of ["Bot Mode", "Quick Match", "Play a Friend", "Offline Local"]) expect(markup).toContain(`aria-label="${mode}"`);
    expect(markup).not.toContain('aria-label="Spectate"');
    expect(markup).toMatch(/aria-label="Bot Mode" aria-pressed="true"/);
    expect(markup).toMatch(/<div class="play-start-dock"><button[^>]*>Start Game<\/button><\/div>/);
    expect(markup).not.toContain("Matchmaking");
    expect(markup).toContain("Blitz 5+0");
    // The page heading holds the game picker button, whose name keeps the visible title.
    expect(markup).toMatch(/<h1 class="play-title"><button[^>]*aria-expanded="false"[^>]*><span class="play-title-text">Classic Chess<\/span>.*?<span class="sr-only">, choose game<\/span><\/button><\/h1>/);
    expect(markup).toContain("Import game");
    expect(markup).not.toContain("play-mode-card");
  });

  test("lobby redirects to Home, the single landing page", async () => {
    await expect(LobbyPage({ params: Promise.resolve({ locale: "en" }) })).rejects.toMatchObject({ message: "NEXT_REDIRECT", digest: expect.stringMatching(/^NEXT_REDIRECT;\w+;\/en;/) });
  });

  test("games catalog keeps one filter row and library-style cards", async () => {
    const element = await VariantsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain(">Games</h1>");
    expect(markup).not.toContain("Bot training status");
    expect(markup).toContain('aria-label="Filter by family"');
    expect(markup).not.toContain("Open guide for");
    expect(markup).toContain('href="/en/games/classic"');
    expect(markup).toContain("Rules only");
    expect(markup).not.toContain('aria-label="Status filter"');
    expect(markup).toContain('aria-label="Search games"');
    expect(markup).not.toContain("Full Guide");
  });

  test("catalog guide overlay keeps full guide inside the focused sheet", () => {
    const classic = getGameCatalogEntry("classic");
    if (!classic) throw new Error("Classic Chess catalog entry is required for guide overlay tests.");

    const markup = renderToStaticMarkup(<CatalogInfoOverlay entry={classic} locale="en" onClose={() => undefined} />);

    expect(markup).toContain("Full guide");
    expect(markup).toContain("Basics");
    expect(markup).toContain("How it ends");
    expect(markup).toContain("Status");
    expect(markup).toContain("/en/play/classic?bot=normal&amp;mode=bot&amp;time=rapid");
  });

  test("game detail route safely resolves aliases and malformed ids", async () => {
    const element = await GameDetailPage({ params: Promise.resolve({ locale: "en", gameId: "dou-shou-qi" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain(">Jungle</h1>");
    expect(markup).toContain("Dòu Shòu Qí · 鬥獸棋 · ");
    expect(markup).toContain("Games</a>");
    expect(markup).toContain("Basic rules");
    for (const devOnly of ["Ready to play", "Training focus", "Verified rules", "Rules gate", ">Modes<"]) expect(markup).not.toContain(devOnly);
    expect(markup).toContain('class="game-sources-line"');
    await expect(GameDetailPage({ params: Promise.resolve({ locale: "en", gameId: "%E0%A4%A" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  test("Cambodian guides expose local preview without claiming online readiness", async () => {
    const markup = renderToStaticMarkup(await GameDetailPage({ params: Promise.resolve({ locale: "en", gameId: "ouk-chaktrang" }) }));
    expect(markup).toContain('/en/play/ouk-chaktrang?mode=offline&amp;time=rapid');
    expect(markup).toContain('Local play is available. Online play is not ready.');
    // The icon-only favorite star is the one control that keeps a hover label; notes carry none.
    expect(markup.match(/title="[^"]*"/g)).toEqual(['title="Favorite"']);
    expect(markup).toContain('aria-label="Favorite"');
    expect(markup).not.toContain('Ouk Chaktrang / Ouk Chaktrang');
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
    // The picker's current value is its description, so screen readers hear it before opening.
    const valueId = markup.match(/aria-label="Bot difficulty" aria-describedby="([^"]+)"/)?.[1];
    expect(valueId).toBeTruthy();
    expect(markup).toContain(`<strong id="${valueId}">2800-2900 Elo</strong>`);
    expect(markup).toContain('aria-label="Bot difficulty options"');
    expect(markup).toContain("Blitz 5+0");
    await expect(PlayPage({ params: Promise.resolve({ locale: "en", gameId: "%E0%A4%A" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  test("history is its own compact records page", async () => {
    const element = await HistoryPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain(">History</h1>");
    expect(markup).not.toContain("Match records");
    expect(markup).toContain("No online games yet");
    expect(markup).toContain("Online games you finish appear here");
    expect(markup).not.toContain("Search saved games");
    expect(markup).not.toContain("Filter history result");
    expect(markup).toContain("/en/play?mode=online&amp;time=rapid");
    expect(markup).not.toContain("Search unlocks after saved matches");
    expect(markup).not.toContain("redirect");
  });

  test("leaderboards are honest while rated results are empty", async () => {
    const element = await LeaderboardsPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Leaderboards");
    expect(markup).toContain(">No rated results yet</h2>");
    expect(markup).toContain("Play online");
    expect(markup).not.toContain("aria-label=\"Leaderboard filters\"");
    expect(markup).toContain("Rankings appear after rated games are recorded.");
    expect(markup).not.toContain("disabled=\"\"");

    const scoped = renderToStaticMarkup(await LeaderboardsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ scope: "playable" }) }));
    expect(scoped).toContain("aria-label=\"Leaderboard filters\"");
    expect(scoped).toContain("aria-label=\"Leaderboard scope: Playable games\"");
    expect(scoped).toContain("Choose a leaderboard scope");
    expect(scoped).toContain("/en/leaderboards?scope=family%3Achess-family");
  });

  test("watch rooms keeps only the room search when no rooms exist", async () => {
    const element = await WatchPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Watch rooms");
    expect(markup).toContain("No public rooms right now");
    expect(markup).toContain("aria-label=\"Watch room controls\"");
    expect(markup).toContain("aria-label=\"Search rooms\"");
    expect(markup).toContain('placeholder="Room ID"');
    expect(markup).not.toContain('aria-label="Room filters"');
    expect(markup).not.toContain("/en/watch?status=active");
    expect(markup).toContain("Play online");
    expect(markup).not.toContain("Search unlocks when public rooms are available.");
  });

  test("watch room query from chat exposes a direct spectate handoff", async () => {
    const element = await WatchPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ q: "mini-shogi-local", variant: "mini-shogi" })
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Open searched room");
    expect(markup).toContain("Mini Shogi / mini-shogi-local");
    expect(markup).toContain("/en/play/mini-shogi?mode=spectate&amp;room=mini-shogi-local");
    expect(markup).toContain('name="variant"');
    expect(markup).toContain('value="mini-shogi"');
  });

  test("analysis without a saved game shows one empty state instead of disabled controls", async () => {
    const element = await AnalysisPage({ params: Promise.resolve({ locale: "en", gameId: "demo" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("No saved review yet");
    expect(markup).toContain("/en/history");
    expect(markup).toContain('aria-label="Back to history"');
    expect(markup).not.toContain("Game demo");
    expect(markup).toContain("Play online");
    expect(markup).not.toContain("aria-label=\"Review playback controls\"");
    expect(markup).not.toContain("disabled=\"\"");
  });

  test("settings page keeps preference rows compact", async () => {
    const element = await SettingsPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(<ThemeProvider>{element}</ThemeProvider>);

    expect(markup).toContain(">Settings</h1>");
    expect(markup).toContain('aria-label="Theme"');
    expect(markup).toContain("System");
    expect(markup).toContain("Language");
    expect(markup).not.toContain('class="info-hint');
    expect(markup).toContain("/en/login");
    expect(markup).not.toContain("Notifications");
    expect(markup).not.toContain("A multilingual multiplayer chess platform");
  });

  test("account pages keep empty states concise", async () => {
    const profile = await ProfilePage({ params: Promise.resolve({ locale: "en", username: "player" }) });
    const markup = renderToStaticMarkup(profile);

    expect(markup).not.toContain("Profile &amp; history");
    expect(markup).toContain("No matches yet");
    expect(markup).not.toContain('class="info-hint');
    expect(markup).toContain("Guest player");
    expect(markup).toContain("/en/login");
    expect(markup).toContain("/en/play?mode=online&amp;time=rapid");
    expect(markup).not.toContain("Full history");
    expect(markup).not.toContain('class="profile-stats"');
    expect(markup).not.toContain(">GU<");
    expect(markup).not.toContain("Finished games will appear here after Cloudflare D1 records");
    expect(markup).not.toContain("AllChess will show real per-game ratings");
  });

  test("login keeps account actions clear without advertising unavailable account features", async () => {
    const element = await LoginPage({ params: Promise.resolve({ locale: "en" }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain("Continue with Google");
    expect(markup).toContain("Create account");
    expect(markup).not.toContain("Account benefits");
    expect(markup).not.toContain('class="info-hint');
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
