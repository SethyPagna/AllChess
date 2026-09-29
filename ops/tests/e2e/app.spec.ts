import { expect, test, type Locator, type Page } from "@playwright/test";

/** Quick settings (theme, languages) live in the desktop rail or the mobile top bar, whichever is shown. */
function visibleShell(page: Page) {
  return page.locator("aside.rail:visible, header.topbar:visible");
}

/** Main navigation is the desktop rail or the mobile bottom tab bar. */
function visibleNavigation(page: Page) {
  return page.locator("aside.rail:visible, nav.tab-bar:visible");
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectWithinViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.floor(box!.x)).toBeGreaterThanOrEqual(0);
  expect(Math.ceil(box!.x + box!.width)).toBeLessThanOrEqual(viewport!.width);
  expect(Math.floor(box!.y)).toBeGreaterThanOrEqual(0);
  expect(Math.ceil(box!.y + box!.height)).toBeLessThanOrEqual(viewport!.height);
}

async function expectHorizontallyWithinViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.floor(box!.x)).toBeGreaterThanOrEqual(0);
  expect(Math.ceil(box!.x + box!.width)).toBeLessThanOrEqual(viewport!.width);
}

async function expectNoVisibleUnnamedControls(page: Page) {
  const unnamed = await page.evaluate(() => {
    function isVisible(element: Element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }

    function accessibleName(element: Element) {
      return (element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || element.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim();
    }

    return Array.from(document.querySelectorAll("button, a[href], summary, input, select, textarea"))
      .filter(isVisible)
      .filter((element) => !accessibleName(element))
      .map((element) => element.outerHTML.slice(0, 160));
  });

  expect(unnamed).toEqual([]);
}

test("localized game hub opens the catalog through navigation", async ({ page }, testInfo) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: "Your next move." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  const intro = page.getByLabel("AllChess intro");
  await expect(intro.getByRole("link", { name: "Quick match" })).toHaveAttribute("href", "/en/play?mode=online&time=rapid");
  await expect(intro.getByRole("link", { name: "Play a bot" })).toHaveAttribute("href", "/en/play?mode=bot&time=rapid");
  await expect(visibleNavigation(page).getByRole("link", { name: "Watch", exact: true })).toHaveAttribute("href", "/en/watch");
  const library = page.getByRole("region", { name: "Game library", exact: true });
  await expect(library).toContainText("Ouk Chaktrang");
  await expect(library.getByRole("link", { name: "All games", exact: true })).toHaveAttribute("href", "/en/variants");
  await expect(library.getByRole("link", { name: /^Play / })).toHaveCount(8);
  await expect(library.getByRole("link", { name: /^Play Classic Chess/ })).toBeVisible();
  const xiangqiCard = library.getByRole("link", { name: /^Play Xiangqi/ });
  await expect(xiangqiCard).toHaveAttribute("href", /^\/en\/play\/xiangqi\?/);
  if (testInfo.project.use.isMobile) await expect(page.getByLabel("Classic chess board preview")).toBeHidden();
  else await expect(page.getByLabel("Classic chess board preview")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const gamesNav = visibleNavigation(page).getByRole("link", { name: "Games", exact: true });
  await expect(gamesNav).toHaveAttribute("href", "/en/variants");
  await Promise.all([page.waitForURL(/\/en\/variants$/), gamesNav.click()]);
  await expect(gamesNav).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("games.png"), fullPage: true });
});

test("catalog artwork loads before its full-page capture", async ({ page }, testInfo) => {
  await page.goto("/en/variants");
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("games.png"), fullPage: true });
  for (const artwork of await page.locator(".catalog-grid-min .game-artwork").all()) {
    await artwork.scrollIntoViewIfNeeded();
    await expect.poll(() => artwork.locator("img").evaluateAll((images: HTMLImageElement[]) => images
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.src))).toEqual([]);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("games-loaded.png"), fullPage: true });
});

test("catalog family and search filters open game rules", async ({ page }) => {
  await page.goto("/en/variants");
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  const familyFilters = page.getByRole("group", { name: "Filter by family" });
  await familyFilters.getByRole("button", { name: "Checkers", exact: true }).click();
  await expect(familyFilters.getByRole("button", { name: "Checkers", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".catalog-grid-min").getByRole("link", { name: "English Draughts", exact: true })).toBeVisible();
  await expect(page.locator(".catalog-grid-min").getByRole("link", { name: "Classic Chess", exact: true })).toHaveCount(0);
  await familyFilters.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("textbox", { name: "Search games", exact: true }).fill("xiangqi");
  const xiangqiGuide = page.locator(".catalog-grid-min").getByRole("link", { name: "Xiangqi", exact: true });
  await expect(xiangqiGuide).toHaveAttribute("href", "/en/games/xiangqi");
  await Promise.all([page.waitForURL(/\/en\/games\/xiangqi$/), xiangqiGuide.click()]);
  await expect(page.getByRole("heading", { name: "Xiangqi", exact: true })).toBeVisible();
  await expect(page.locator(".game-section[open]")).toContainText("Basic rules");
  await expect(page.locator(".game-hero-actions").getByRole("link", { name: "Play", exact: true })).toHaveAttribute("href", /\/en\/play\/xiangqi\?mode=offline&time=rapid$/);
  await expectNoHorizontalOverflow(page);
});

test("play setup exposes bot, friend, and spectator controls", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as typeof window & { __allChessCopiedText?: string }).__allChessCopiedText = value;
        }
      }
    });
  });
  await page.goto("/en/play");
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("play.png"), fullPage: true });
  await expect(page.getByRole("button", { name: /^Classic Chess\s*, choose game$/ })).toBeVisible();
  const playModes = page.getByRole("group", { name: "Play modes" });
  for (const mode of ["Bot Mode", "Quick Match", "Play a Friend", "Offline Local"]) await expect(playModes.getByRole("button", { name: mode, exact: true })).toBeVisible();
  await expect(playModes.getByRole("button", { name: "Quick Match", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(playModes.getByRole("button", { name: /Matchmaking/ })).toHaveCount(0);
  await expect(playModes).not.toContainText("Matchmaking");
  await expectNoHorizontalOverflow(page);
  await playModes.getByRole("button", { name: "Bot Mode", exact: true }).click();
  await expect(playModes.getByRole("button", { name: "Bot Mode", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();
  await page.getByLabel("Bot difficulty", { exact: true }).click();
  await expect(page.getByRole("group", { name: "Bot difficulty options" })).toContainText("100-200 Elo");
  await expect(page.getByRole("group", { name: "Bot difficulty options" })).toContainText("3900-4000 Elo");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Bot difficulty options" })).toBeHidden();
  await expect(page.locator(".play-title-actions").getByRole("button", { name: "Game guide" })).toBeVisible();
  await expect(page.locator(".play-title-actions").getByRole("button", { name: "Share game" })).toBeVisible();
  // Draw and resign only exist once a game is running; setup shows the start action instead.
  await expect(page.getByLabel("Board controls", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Draw", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resign", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Game", exact: true })).toBeVisible();
  await page.locator(".play-title-actions").getByRole("button", { name: "Share game" }).click();
  const shareDialog = page.getByRole("dialog", { name: "Share game options" });
  await expect(shareDialog).toContainText("Create a friend room to get an invite.");
  await expect(shareDialog.getByRole("link", { name: /Invite link/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Room setup/ }).click();
  await expect(playModes.getByRole("button", { name: "Play a Friend", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Create Room" })).toBeVisible();
  await expect(page.getByLabel("Bot difficulty")).toHaveCount(0);
  await page.goto("/en/play/classic?mode=spectate");
  await expect(playModes.getByRole("button", { name: "Spectate", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Watching" })).toBeVisible();
  await expect(page.getByLabel("Bot difficulty")).toHaveCount(0);
  await expect(page.locator(".play-title-actions").getByRole("button", { name: "Game guide" })).toBeVisible();
  await expect(page.locator(".play-title-actions").getByRole("button", { name: "Share game" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("settings exposes language and theme controls", async ({ page }) => {
  await page.goto("/ar/settings");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "الإعدادات" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const language = page.getByRole("main").getByRole("combobox");
  await expect(language).toHaveValue("ar");
  await language.selectOption("en");
  await expect(page).toHaveURL(/\/en\/settings$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(language).toHaveValue("en");
  await expect(page.getByRole("main").getByRole("button", { name: "Dark" })).toBeVisible();
});

/** Relative luminance (0 dark .. 1 light) of the first opaque background at or behind an element. */
async function surfaceLuminance(locator: Locator) {
  return locator.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const match = getComputedStyle(node).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!match) continue;
      const [r = 0, g = 0, b = 0, alpha = 1] = match[1]!.split(/[,\s/]+/).filter(Boolean).map(Number);
      if (alpha > 0) return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    return 1;
  });
}

test("light theme keeps board player cards on light surfaces", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("allchess-theme", "light"));
  await page.goto("/en/play/classic");

  // Player cards are now chrome-less strips, so check the surface they sit on and the clock chip instead of a card fill.
  const blackPlayerCard = page.getByLabel("Black player card");
  const blackClock = blackPlayerCard.getByLabel("Black clock");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(blackPlayerCard).not.toHaveCSS("background-color", "rgb(36, 35, 31)");
  await expect.poll(() => surfaceLuminance(blackPlayerCard)).toBeGreaterThan(0.6);
  await expect.poll(() => surfaceLuminance(blackClock)).toBeGreaterThan(0.6);
  await expect(page.getByLabel("Game board").locator(".board-coordinate").first()).toBeVisible();

  await visibleShell(page).getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(visibleShell(page).getByRole("button", { name: "Light" })).toBeVisible();
  await expect.poll(() => surfaceLuminance(blackPlayerCard)).toBeLessThan(0.3);
  await expect.poll(() => surfaceLuminance(blackClock)).toBeLessThan(0.3);
  await expectNoHorizontalOverflow(page);
});

test("login explains unavailable Google sign-in", async ({ page }) => {
  await page.goto("/en/login?error=google-oauth-not-configured");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator(".auth-error")).toContainText("Google sign-in is not configured yet.");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("login masks unknown auth errors", async ({ page }) => {
  await page.goto("/en/login?error=%3Cscript%3Ebad()%3C%2Fscript%3E");

  await expect(page).toHaveURL(/\/en\/login\?error=auth-error$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator(".auth-error")).toContainText("We could not complete sign-in.");
  await expect(page.locator(".auth-error")).not.toContainText("bad()");
  await expectNoHorizontalOverflow(page);
});

test("invalid login keeps the active locale", async ({ page }) => {
  await page.goto("/fr/login");

  await page.locator('input[name="email"]').fill("player@example.com");
  await page.locator('input[name="password"]').fill("x");
  await Promise.all([
    page.waitForURL(/\/fr\/login\?error=invalid-credentials$/),
    page.getByRole("button", { name: "Connexion" }).click()
  ]);
  await expect(page.locator(".auth-error")).toContainText("Enter a valid email");
  await expectNoHorizontalOverflow(page);
});

test("login explains duplicate account code", async ({ page }) => {
  await page.goto("/en/login?error=account-exists");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator(".auth-error")).toContainText("An account already exists for this email.");
  await expect(page.locator(".auth-error")).toContainText("Sign in instead");
  await expectNoHorizontalOverflow(page);
});

test("mobile shell language, more menu, and board controls stay in bounds", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/en/play/classic");

  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  const mobileHeader = page.locator("header.topbar");
  const tabBar = page.locator("nav.tab-bar");
  await expect(mobileHeader).toBeVisible();
  await expect(tabBar).toBeVisible();
  await expect(page.locator("aside.rail")).toBeHidden();
  for (const tab of ["Home", "Play", "Games", "Watch"]) await expect(tabBar.getByRole("link", { name: tab, exact: true })).toBeVisible();
  await expect(tabBar.getByRole("link", { name: "Play", exact: true })).toHaveAttribute("aria-current", "page");
  await expectWithinViewport(page, tabBar);
  await expectNoVisibleUnnamedControls(page);
  await expectNoHorizontalOverflow(page);

  const languagePanel = mobileHeader.locator(".language-menu-panel");
  const moreSheet = tabBar.locator(".tab-sheet");
  await mobileHeader.getByLabel("Languages").click();
  await expect(mobileHeader.getByRole("link", { name: "Français" })).toBeVisible();
  await expectWithinViewport(page, languagePanel);
  await tabBar.getByLabel("More", { exact: true }).click();
  await expect(languagePanel).toBeHidden();
  await expect(moreSheet.getByRole("link", { name: "History", exact: true })).toBeVisible();
  await expectWithinViewport(page, moreSheet);
  await mobileHeader.getByLabel("Languages").click();
  await expect(moreSheet).toBeHidden();
  await expectWithinViewport(page, languagePanel);
  await Promise.all([page.waitForURL(/\/fr\/play\/classic$/), mobileHeader.getByRole("link", { name: "Français" }).click()]);
  await expect(page).toHaveURL(/\/fr\/play\/classic$/);
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/play/classic");
  await tabBar.getByLabel("More", { exact: true }).click();
  for (const link of ["History", "Leaderboards", "Profile", "Settings"]) await expect(moreSheet.getByRole("link", { name: link, exact: true })).toBeVisible();
  await expectWithinViewport(page, moreSheet);
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(moreSheet).toBeHidden();

  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  const controls = page.getByLabel("Board controls", { exact: true });
  await expect(controls).toBeVisible();
  await expectHorizontallyWithinViewport(page, controls);
  await expect(controls.getByRole("button", { name: "Suggest a move" })).toBeEnabled();
  await expect(controls.getByRole("button", { name: "Resign" })).toBeEnabled();
  await expect(controls.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apply move" })).toHaveCount(0);
  await controls.getByLabel("More game actions").click();
  const gameMenu = controls.locator(".play-more-menu");
  for (const action of ["Redo", "Move for me", "Pause game", "Export game", "New game"]) await expect(gameMenu.getByRole("button", { name: action, exact: true })).toBeVisible();
  await expectWithinViewport(page, gameMenu);
  await page.keyboard.press("Escape");
  await expect(gameMenu).toBeHidden();
  await expectNoVisibleUnnamedControls(page);
  await expectNoHorizontalOverflow(page);
});

test("catalog mode filter carries a playable choice into its rules and launch links", async ({ page }) => {
  await page.goto("/en/variants");

  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  const filters = page.getByRole("button", { name: /^Filters/ });
  await filters.click();
  const botMode = page.getByRole("group", { name: "Mode filter" }).getByRole("button", { name: "Bot", exact: true });
  await botMode.click();
  await expect(botMode).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(filters).toBeFocused();
  const classicGuide = page.locator(".catalog-grid-min").getByRole("link", { name: "Classic Chess", exact: true });
  await expect(classicGuide).toHaveAttribute("href", "/en/games/classic?mode=bot");
  await Promise.all([page.waitForURL(/\/en\/games\/classic\?mode=bot$/), classicGuide.click()]);
  await expect(page.getByRole("heading", { name: "Classic Chess", exact: true })).toBeVisible();
  const actions = page.locator(".game-hero-actions");
  await expect(actions.getByRole("link", { name: "Play", exact: true })).toHaveAttribute("href", "/en/play/classic?mode=offline&time=rapid");
  await expect(actions.getByRole("link", { name: "Play a bot", exact: true })).toHaveAttribute("href", "/en/play/classic?bot=normal&mode=bot&time=rapid");
  await expect(page.locator(".game-section[open]")).toContainText("Basic rules");
  const endings = page.locator(".game-section").filter({ has: page.locator("summary", { hasText: "How it ends" }) });
  await endings.locator("summary").click();
  await expect(endings.locator("li").first()).toBeVisible();
  await expect(page.locator(".game-sources-line a").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("watch rooms and catalog filters land on honest real-data views", async ({ page }) => {
  await page.goto("/en/watch");

  await expect(page.getByRole("heading", { name: "Watch rooms" })).toBeVisible();
  await expect(page.getByLabel("Watch room controls").getByLabel("Search rooms")).toBeVisible();
  await expect(page.getByLabel("Watch room controls").getByRole("button", { name: "Search" })).toBeEnabled();
  const publicRooms = page.getByLabel("Public rooms", { exact: true });
  if (await publicRooms.count()) {
    await expect(publicRooms.getByRole("link").first()).toHaveAttribute("href", /mode=spectate&room=/);
    await expect(page.getByLabel("Watch room controls").getByRole("link", { name: "Live", exact: true })).toHaveAttribute("href", "/en/watch?status=active");
    await expect(page.getByLabel("Watch room controls").getByRole("link", { name: "Popular", exact: true })).toHaveAttribute("href", "/en/watch?sort=spectators");
  } else {
    await expect(page.getByText("No public rooms right now", { exact: true })).toBeVisible();
    const playOnline = page.getByRole("main").getByRole("link", { name: "Play online", exact: true });
    await expect(playOnline).toHaveAttribute("href", "/en/play?mode=online&time=rapid");
    await expectHorizontallyWithinViewport(page, playOnline);
  }
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/variants?playability=learn");
  const filtersButton = page.getByRole("button", { name: /Filters/ });
  await filtersButton.click();
  await expect(page.getByRole("group", { name: "Mode filter" }).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Catalog filters", { exact: true })).toHaveCount(0);
  await expect(filtersButton).toBeFocused();
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  await expect(page.locator("details.catalog-more-games")).toHaveAttribute("open", "");
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/leaderboards?scope=family:asian-chess");
  await expect(page.getByRole("heading", { name: "Leaderboards" })).toBeVisible();
  const scopeMenu = page.getByRole("navigation", { name: "Leaderboard filters" });
  await scopeMenu.getByLabel(/^Leaderboard scope:/).click();
  await expect(scopeMenu.locator('a[aria-current="true"]')).toHaveAttribute("href", "/en/leaderboards?scope=family%3Aasian-chess");
  await page.keyboard.press("Escape");
  await expect(page.getByText("No rated results yet", { exact: true })).toBeVisible();
  const playOnline = page.getByRole("main").getByRole("link", { name: "Play online", exact: true });
  await expect(playOnline).toHaveAttribute("href", "/en/play?mode=online&time=rapid");
  await expectHorizontallyWithinViewport(page, playOnline);
  await expectNoHorizontalOverflow(page);
});

test("analysis empty state explains how to get a saved review", async ({ page }) => {
  await page.goto("/en/analysis/demo-game");

  await expect(page.getByRole("heading", { name: "AI analysis" })).toBeVisible();
  await expect(page.getByText("No saved review yet", { exact: true })).toBeVisible();
  await expect(page.getByText("Finished games you save get a move-by-move review here.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Review playback controls")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Play online", exact: true })).toHaveAttribute("href", "/en/play?mode=online&time=rapid");
  await expectNoHorizontalOverflow(page);
});

test("legacy practice route redirects into the unified games and rules flow", async ({ page }) => {
  await page.goto("/en/practice");

  await expect(page).toHaveURL(/\/en\/variants\?playability=playable$/);
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Filters/ }).click();
  await expect(page.getByRole("group", { name: "Mode filter" }).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".catalog-grid-min").getByRole("link", { name: "Classic Chess", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("public shortcut links redirect to accessible localized pages", async ({ page }) => {
  await page.goto("/learn");
  await expect(page).toHaveURL(/\/en\/variants$/);
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/games");
  await expect(page).toHaveURL(/\/en\/variants$/);
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/chess");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your next move." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Game library", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/lobby");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your next move." })).toBeVisible();
});

test("public routes expose page-specific document titles", async ({ page }) => {
  const routes = [
    { path: "/en", title: "AllChess - Every board, every rival, one polished arena." },
    { path: "/en/play", title: "AllChess - Play" },
    { path: "/en/play/classic", title: "AllChess - Classic Chess" },
    { path: "/en/variants", title: "AllChess - Games & rules" },
    { path: "/en/watch", title: "AllChess - Watch rooms" },
    { path: "/en/leaderboards", title: "AllChess - Leaderboards" },
    { path: "/en/history", title: "AllChess - History" },
    { path: "/en/settings", title: "AllChess - Settings" }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page).toHaveTitle(route.title);
  }
});

test("language menu keeps the current route", async ({ page }) => {
  await page.goto("/en/play/classic");

  const shell = visibleShell(page);
  await shell.getByLabel("Languages").click();
  await expectWithinViewport(page, shell.locator(".language-menu-panel"));
  const french = shell.getByRole("link", { name: "Français" });
  await expect(french).toHaveAttribute("href", "/fr/play/classic");
  await Promise.all([page.waitForURL(/\/fr\/play\/classic$/), french.click()]);

  await expect(page).toHaveURL(/\/fr\/play\/classic$/);
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("language menu preserves catalog filters", async ({ page }) => {
  await page.goto("/en/variants?playability=learn");

  const shell = visibleShell(page);
  await shell.getByLabel("Languages").click();
  const german = shell.getByRole("link", { name: "Deutsch" });
  await expect(german).toHaveAttribute("href", "/de/variants?playability=learn");
  await Promise.all([page.waitForURL(/\/de\/variants\?playability=learn$/), german.click()]);

  await expect(page).toHaveURL(/\/de\/variants\?playability=learn$/);
  await page.getByRole("button", { name: /Filters/ }).click();
  await expect(page.getByRole("group", { name: "Mode filter" }).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("details.catalog-more-games")).toHaveAttribute("open", "");
  await expectNoHorizontalOverflow(page);
});

test("catalog search finds native and romanized game names", async ({ page }) => {
  await page.goto("/en/variants");

  await page.getByRole("textbox", { name: "Search games", exact: true }).fill("Dou Shou Qi");
  await expect(page.locator(".catalog-grid-min").getByRole("link", { name: "Jungle", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("textbox", { name: "Search games", exact: true }).fill("Oware");
  const owareGuide = page.locator(".catalog-more-list").getByRole("link", { name: /Oware/ });
  await expect(owareGuide).toHaveAttribute("href", "/en/games/oware");
  await Promise.all([page.waitForURL(/\/en\/games\/oware$/), owareGuide.click()]);
  await expect(page.getByRole("heading", { name: /Oware/ })).toBeVisible();
  await expect(page.locator(".game-section[open]")).toContainText("Basic rules");
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/games/shogi");
  await expect(page.getByRole("heading", { name: "Shogi", exact: true })).toBeVisible();
  await expect(page.getByLabel("Training and rules gate")).toHaveCount(0);
  await expect(page.getByText("Drops are legal except illegal pawn drops, non-moving drops, and pawn-drop mate.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Japan Shogi Association basic rules", exact: true })).toHaveAttribute("href", "https://www.shogi.or.jp/knowledge/shogi/02.html");
  await expectNoHorizontalOverflow(page);
});
