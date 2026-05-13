import { expect, test } from "@playwright/test";

test("suggestion, bot reply, and board geometry remain stable", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();
  const before = await board.boundingBox();
  expect(before).toBeTruthy();

  const firstPiece = board.locator(".piece-symbol").first();
  await expect(firstPiece).toBeVisible();
  await expect(firstPiece).toHaveCSS("opacity", "1");
  await expect(firstPiece).toHaveCSS("filter", "none");

  await page.getByRole("button", { name: "Suggest" }).click();
  await expect(board.locator('[data-suggested="from"]')).toBeVisible();
  await expect(board.locator('[data-suggested="to"]')).toBeVisible();
  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(page.getByText(/^1\./)).toBeVisible();

  const afterSuggestion = await board.boundingBox();
  expect(afterSuggestion?.width).toBeCloseTo(before!.width, 1);
  expect(afterSuggestion?.height).toBeCloseTo(before!.height, 1);

  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Bot opponent" }).click();
  await page.getByRole("button", { name: /e2.*pawn/i }).click();
  await page.getByRole("button", { name: "e4" }).click();
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 5000 });

  const afterBot = await board.boundingBox();
  expect(afterBot?.width).toBeCloseTo(before!.width, 1);
  expect(afterBot?.height).toBeCloseTo(before!.height, 1);
  expect(runtimeErrors).toEqual([]);
});
