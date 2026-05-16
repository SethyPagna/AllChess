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
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByText("Match center")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Game Tools" })).toHaveCount(0);
  await expect(page.getByText("Review hook")).toHaveCount(0);
  await expect(page.getByLabel("Bot response profile")).toContainText("cache first");
  const before = await board.boundingBox();
  expect(before).toBeTruthy();

  const firstPiece = board.locator(".piece-symbol").first();
  await expect(firstPiece).toBeVisible();
  await expect(firstPiece).toHaveCSS("opacity", "1");
  await expect(firstPiece).toHaveCSS("filter", "none");
  await expect(board.locator('[data-piece="king"]').first()).toBeVisible();
  await expect(board.locator('[data-piece="queen"]').first()).toBeVisible();

  await page.getByRole("button", { name: "Suggest" }).click();
  await expect(board.locator('[data-suggested="from"]')).toBeVisible();
  await expect(board.locator('[data-suggested="to"]')).toBeVisible();
  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(page.getByText(/^1\./)).toBeVisible();

  const afterSuggestion = await board.boundingBox();
  expect(afterSuggestion?.width).toBeCloseTo(before!.width, 1);
  expect(afterSuggestion?.height).toBeCloseTo(before!.height, 1);

  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByLabel("Side").selectOption("first");
  await page.getByRole("button", { name: /Play Bots/ }).last().click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByText(/Play Bots started/i)).toBeVisible();
  await page.getByRole("button", { name: /e2.*pawn/i }).click();
  await page.getByRole("button", { name: "e4" }).click();
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 5000 });

  const afterBot = await board.boundingBox();
  expect(afterBot?.width).toBeCloseTo(before!.width, 1);
  expect(afterBot?.height).toBeCloseTo(before!.height, 1);
  expect(runtimeErrors).toEqual([]);
});

test("checkmate shows match-over feedback without resizing the board", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();
  await page.getByRole("button", { name: "Start Game" }).click();
  const before = await board.boundingBox();
  expect(before).toBeTruthy();

  await page.getByRole("button", { name: /f2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "f3" }).click();
  await page.getByRole("button", { name: /e7.*black.*pawn/i }).click();
  await page.getByRole("button", { name: "e5" }).click();
  await page.getByRole("button", { name: /g2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "g4" }).click();
  await page.getByRole("button", { name: /d8.*black.*queen/i }).click();
  await page.getByRole("button", { name: "h4" }).click();

  const dialog = page.getByRole("dialog", { name: "Match over" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /checkmate/i })).toBeVisible();
  await expect(dialog.getByText(/escape, capture, or block/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review moves" })).toBeVisible();

  const afterMate = await board.boundingBox();
  expect(afterMate?.width).toBeCloseTo(before!.width, 1);
  expect(afterMate?.height).toBeCloseTo(before!.height, 1);
  expect(runtimeErrors).toEqual([]);
});

test("setup flow supports bot practice as black with an automatic first reply", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play");
  await expect(page.getByRole("heading", { name: "Choose how you want to play" })).toBeVisible();

  await page.goto("/en/play/classic?mode=bot&bot=normal");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();
  const before = await board.boundingBox();
  expect(before).toBeTruthy();

  await page.getByLabel("Side").selectOption("second");
  await page.getByLabel("Bot difficulty").first().selectOption("grandmaster");
  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByText(/You: Black/)).toBeVisible();
  await expect(page.getByText(/View: Black/)).toBeVisible();
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/Bot source:/)).toBeVisible();
  await expect(page.getByText(/opening-book|internal-search|engine-search/)).toBeVisible();

  const after = await board.boundingBox();
  expect(after?.width).toBeCloseTo(before!.width, 1);
  expect(after?.height).toBeCloseTo(before!.height, 1);
  expect(runtimeErrors).toEqual([]);
});

test("classic grandmaster uses Stockfish on off-book replies", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic?mode=bot&bot=grandmaster");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();

  await page.getByLabel("Side").selectOption("first");
  await page.getByLabel("Bot difficulty").first().selectOption("grandmaster");
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.getByRole("button", { name: /h2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "h3" }).click();

  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 7000 });
  await expect(page.getByText(/Bot source:\s*engine-search/i)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
