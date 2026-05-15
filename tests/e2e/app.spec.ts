import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth));
  expect(overflow).toBeLessThanOrEqual(1);
}

test("localized game hub can open variants and a playable board", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "AllChess" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/variants");
  await expect(page.getByRole("heading", { name: "Global variant atlas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xiangqi / Xiàngqí / 象棋" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/en/play");
  await expect(page.getByRole("heading", { name: "Choose how you want to play" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "Quick bot game" }).click();
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();
  await expect(page.getByLabel("Bot difficulty")).toContainText("Grandmaster");
  await expect(page.getByLabel("Bot difficulty")).toContainText("Legend");
  await expect(page.getByLabel("Rules summary")).toBeVisible();
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

test("language menu keeps the current route", async ({ page }) => {
  await page.goto("/en/play/classic");

  await page.getByLabel("Languages").click();
  const french = page.getByRole("link", { name: "Francais" }).or(page.getByRole("link", { name: "Français" }));
  await expect(french).toHaveAttribute("href", "/fr/play/classic");
  await Promise.all([page.waitForURL(/\/fr\/play\/classic$/), french.click({ force: true })]);

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
  await page.getByRole("link", { name: "Learn" }).first().click();
  await expect(page.getByRole("heading", { name: /Oware/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
