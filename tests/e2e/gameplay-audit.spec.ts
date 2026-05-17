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
  const coordinate = board.locator(".board-coordinate").first();
  await expect(coordinate).toBeVisible();
  await expect(coordinate).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).toHaveCSS("box-shadow", "none");
  await expect(coordinate).toHaveCSS("border-radius", "0px");

  await page.getByRole("button", { name: "Suggest" }).click();
  await expect(board.locator('[data-suggested="from"]')).toBeVisible();
  await expect(board.locator('[data-suggested="to"]')).toBeVisible();
  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(page.getByText(/^1\./)).toBeVisible();

  const afterSuggestion = await board.boundingBox();
  expect(afterSuggestion?.width).toBeCloseTo(before!.width, 1);
  expect(afterSuggestion?.height).toBeCloseTo(before!.height, 1);

  await page.locator(".play-header-command-actions").getByRole("button", { name: "New" }).click();
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
  await dialog.getByRole("button", { name: "Close match result" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(/checkmate/i).first()).toBeVisible();

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

test("online setup disables bot controls and shows opponent search", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  await page.getByRole("button", { name: "Play Online" }).click();
  await expect(page.getByLabel("Bot difficulty")).toBeDisabled();
  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByText("Searching for opponent").first()).toBeVisible();
  await expect(page.getByLabel("Online matchmaking status")).toContainText("Searching for opponent");
  await expect(page.getByLabel("Online matchmaking status")).toContainText("Bot difficulty and automation are paused");
  await expect(page.getByLabel("Board controls")).toContainText("Human match only");
  await expect(page.getByRole("button", { name: "Play Bots" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apply disabled" })).toBeDisabled();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Resign" })).toBeDisabled();
  expect(runtimeErrors).toEqual([]);
});

test("spectate mode is read-only after start", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  await page.locator(".play-header-command-actions").getByRole("button", { name: "Watch" }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByLabel("Match summary")).toContainText("Watching rooms");
  await expect(page.getByText("Watching rooms").first()).toBeVisible();
  await expect(page.getByText("Spectate mode is read-only. Watch rooms without moving pieces.")).toBeVisible();

  await page.getByRole("button", { name: /e2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "e4" }).click();
  await expect(page.getByText("Spectate mode is read-only. Choose a playable mode to move pieces.")).toBeVisible();
  await expect(page.getByText(/^1\./)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Move" })).toBeDisabled();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Resign" })).toBeDisabled();
  expect(runtimeErrors).toEqual([]);
});

test("resign result can be dismissed and reset to setup cleanly", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Resign" })).toBeEnabled();
  await page.locator(".play-header-command-actions").getByRole("button", { name: "Resign" }).click();

  const dialog = page.getByRole("dialog", { name: "Match over" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("resignation");
  await dialog.getByRole("button", { name: "Close match result" }).click();
  await expect(dialog).toHaveCount(0);

  await page.locator(".play-header-command-actions").getByRole("button", { name: "New" }).click();
  await expect(page.getByLabel("Match summary")).toContainText("Offline Local setup");
  await expect(page.getByText("Choose setup first")).toBeVisible();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(page.locator(".play-header-command-actions").getByRole("button", { name: "Resign" })).toBeDisabled();
  expect(runtimeErrors).toEqual([]);
});

test("non-classic boards use clean coordinate labels too", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/xiangqi");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();
  await expect(board.locator(".board-square")).toHaveCount(90);
  const coordinate = board.locator(".board-coordinate").first();
  await expect(coordinate).toBeVisible();
  await expect(coordinate).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).toHaveCSS("box-shadow", "none");
  await expect(coordinate).toHaveCSS("border-radius", "0px");

  const boardBox = await board.boundingBox();
  const coordinateBox = await coordinate.boundingBox();
  expect(boardBox).toBeTruthy();
  expect(coordinateBox).toBeTruthy();
  expect(coordinateBox!.x).toBeGreaterThanOrEqual(boardBox!.x);
  expect(coordinateBox!.y).toBeGreaterThanOrEqual(boardBox!.y);
  expect(coordinateBox!.x + coordinateBox!.width).toBeLessThanOrEqual(boardBox!.x + boardBox!.width);
  expect(coordinateBox!.y + coordinateBox!.height).toBeLessThanOrEqual(boardBox!.y + boardBox!.height);
  expect(runtimeErrors).toEqual([]);
});
