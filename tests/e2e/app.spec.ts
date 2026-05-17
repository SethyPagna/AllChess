import { expect, test, type Locator, type Page } from "@playwright/test";

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

test("localized game hub can open variants and a playable board", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "AllChess" })).toBeVisible();
  await expect(page.getByLabel("AllChess intro")).toContainText("Play first");
  await expect(page.getByRole("link", { name: "Start playing" })).toHaveAttribute("href", "/en/play");
  await expect(page.getByLabel("AllChess intro").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/login");
  await expect(page.getByLabel("How AllChess works")).toContainText("Pick a board");
  await expect(page.getByRole("link", { name: /Pick a board/ })).toHaveAttribute("href", "/en/play");
  await expect(page.getByRole("link", { name: /Train fast/ })).toHaveAttribute("href", "/en/variants?playability=playable");
  await expect(page.getByRole("link", { name: /Watch or review/ })).toHaveAttribute("href", "/en/watch");
  await expect(page.getByLabel("Classic chess board preview")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/variants");
  await expect(page.getByRole("heading", { name: "Games & rules" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xiangqi / Xiàngqí / 象棋" })).toBeVisible();
  await page.getByRole("button", { name: /Open info for Xiangqi/ }).click();
  await expect(page.getByRole("dialog", { name: /Xiangqi.*info/ })).toContainText("Verified ready");
  await expect(page.getByRole("dialog")).toContainText("Status");
  await page.getByRole("button", { name: "Close info" }).click();
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/play");
  await expect(page.getByRole("heading", { name: "Choose how you want to play" })).toBeVisible();
  await expect(page.getByLabel("Play workflow")).toContainText("1. Mode");
  await expect(page.getByLabel("Fast play actions")).toContainText("Play Bots");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "Quick bot game" }).click();
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();
  await expect(page.getByLabel("Bot difficulty")).toContainText("Grandmaster");
  await expect(page.getByLabel("Bot difficulty")).toContainText("Legend");
  await expect(page.getByLabel("Rules summary")).toBeVisible();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "New" })).toBeVisible();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Room" })).toBeVisible();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Watch" })).toBeVisible();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Resign" })).toBeDisabled();
  await expect(
    page.locator(".play-header-command-actions .button-label").evaluateAll((labels) => labels.every((label) => label.getBoundingClientRect().width > 12))
  ).resolves.toBe(true);
  await expectNoHorizontalOverflow(page);
});

test("settings exposes language and theme controls", async ({ page }) => {
  await page.goto("/ar/settings");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "Preferences" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("main").getByLabel("Languages").click();
  await expect(page.getByRole("link", { name: "English" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Dark" })).toBeVisible();
});

test("mobile shell language, notifications, and board controls stay in bounds", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/en/play/classic");

  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const mobileHeader = page.locator(".app-mobile-header");
  await mobileHeader.getByLabel("Languages").click();
  await expect(mobileHeader.getByRole("link", { name: "Français" })).toBeVisible();
  await expectWithinViewport(page, mobileHeader.locator(".language-menu-panel"));
  await Promise.all([page.waitForURL(/\/fr\/play\/classic$/), mobileHeader.getByRole("link", { name: "Français" }).click()]);
  await expect(page).toHaveURL(/\/fr\/play\/classic$/);
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/play/classic");
  await mobileHeader.getByLabel(/Notifications/).click();
  await expect(mobileHeader.getByText("3 unread")).toBeVisible();
  await expect(mobileHeader.getByRole("button", { name: "Mark read" })).toBeVisible();
  await expectWithinViewport(page, mobileHeader.locator(".notification-panel"));
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Status" }).click();
  await expect(page.getByLabel("Board controls")).toBeVisible();
  await expect(page.getByLabel("Board controls")).toContainText("Assist");
  await expect(page.getByLabel("Board controls")).toContainText("Bot automation");
  await expect(page.getByLabel("Board controls")).toContainText("Utilities");
  await expect(page.getByRole("button", { name: "Apply disabled" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test("games and rules shows compact bot training status", async ({ page }) => {
  await page.goto("/en/variants?playability=playable");

  await expect(page.getByRole("heading", { name: "Games & rules" })).toBeVisible();
  await expect(page.getByLabel("Bot training status")).toContainText("Book & tactics");
  await expect(page.getByLabel("Bot training status")).toContainText("tactics");
  await expect(page.getByLabel("Bot training status")).toContainText("3190+ benchmark");
  await expect(page.getByLabel("Bot training status")).toContainText("not fully trained");
  await expect(page.getByRole("link", { name: "Play" }).first()).toBeVisible();
  await expect(page.locator(".catalog-status").filter({ hasText: "Ready to play" }).first()).toBeVisible();
  await page.getByRole("button", { name: /Open info for Classic Chess/ }).click();
  await expect(page.getByRole("dialog", { name: /Classic Chess info/ })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Play" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Bot Mode" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Full Guide" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Basics");
  await expect(page.getByRole("dialog")).toContainText("How it ends");
  await expect(page.getByRole("dialog")).toContainText("Status");
  await expect(page.getByRole("dialog")).toContainText("Verified");
  await page.getByRole("button", { name: "Close info" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("watch rooms and catalog filters land on honest real-data views", async ({ page }) => {
  await page.goto("/en/watch");

  await expect(page.getByRole("heading", { name: "Watch rooms" })).toBeVisible();
  await expect(page.getByText(/No public rooms|Live room list/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/variants?playability=learn");
  await expect(page.getByLabel("Playability")).toHaveValue("learn");
  await expect(page.getByRole("heading", { name: "Games & rules" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("language menu keeps the current route", async ({ page }) => {
  await page.goto("/en/play/classic");

  const visibleShell = page.locator(".app-sidebar:visible, .app-mobile-header:visible");
  await visibleShell.getByLabel("Languages").click();
  await expectWithinViewport(page, visibleShell.locator(".language-menu-panel"));
  const french = visibleShell.getByRole("link", { name: "Français" });
  await expect(french).toHaveAttribute("href", "/fr/play/classic");
  await Promise.all([page.waitForURL(/\/fr\/play\/classic$/), french.click()]);

  await expect(page).toHaveURL(/\/fr\/play\/classic$/);
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("catalog search finds native and romanized game names", async ({ page }) => {
  await page.goto("/en/variants");

  await page.getByPlaceholder("Search names, aliases, native names").fill("Dou Shou Qi");
  await expect(page.getByRole("heading", { name: /Jungle/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByPlaceholder("Search names, aliases, native names").fill("Oware");
  await page.getByRole("button", { name: /Open info for Oware/ }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Full Guide" })).toHaveAttribute("href", "/en/games/oware");
  await page.goto("/en/games/oware");
  await expect(page.getByRole("heading", { name: /Oware/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Basic rules" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/games/shogi");
  await expect(page.getByRole("heading", { name: "Rules gate" })).toBeVisible();
  await expect(page.getByLabel("Training and rules gate")).toContainText("Not fully trained yet");
  await expect(page.getByText("Nifu pawn-drop fixtures")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
