import { expect, test } from "@playwright/test";

test("localized game hub can open variants and a playable board", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "AllChess" })).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Variants" }).click();
  await expect(page.getByRole("heading", { name: "Global variant atlas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xiangqi" })).toBeVisible();

  await page.getByRole("link", { name: "Start" }).first().click();
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();
});

test("settings exposes language and theme controls", async ({ page }) => {
  await page.goto("/ar/settings");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "Preferences" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "English" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Dark" })).toBeVisible();
});
