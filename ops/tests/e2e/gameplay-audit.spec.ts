import { expect, test, type Page } from "@playwright/test";

function clockSeconds(value: string | null) {
  if (!value) return Number.NaN;
  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return Number.NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth));
  expect(overflow).toBeLessThanOrEqual(1);
}

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
  const controls = page.getByLabel("Board controls");
  await expect(controls.locator(".play-control-heading")).toContainText("Ready");
  await expect(controls).not.toContainText("Live");
  await expect(controls.getByLabel("Assist controls")).toContainText("Suggest");
  await expect(controls.getByRole("button", { name: "Apply move" })).toHaveCount(0);
  await expect(controls.getByLabel("Assist controls").getByRole("button")).toHaveCount(7);
  await expect(controls.getByLabel("Match controls")).toContainText("Auto");
  await expect(controls.getByLabel("Match controls")).toContainText("Resign");
  await expect(controls.getByLabel("Utility controls")).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Bot Mode" })).toBeDisabled();
  await expect(page.getByLabel("Local play status")).toContainText("Offline Local");
  await expect(page.locator(".review-position-card")).toContainText("Current position");
  await expect(page.getByLabel("Move review summary")).toBeVisible();
  await expect(page.locator(".review-engine-row")).not.toContainText("Live");
  await expect(page.locator(".review-move-list")).toHaveCSS("overflow-y", "auto");
  await expect(page.locator(".review-move-list")).not.toContainText("Info");
  await expect(page.locator(".review-move-side").first()).toBeVisible();
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
  await expect(coordinate).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).not.toHaveCSS("text-shadow", "none");
  await expect(page.getByLabel("Black player card")).not.toHaveCSS("background-color", "rgb(36, 35, 31)");

  await controls.getByRole("button", { name: "Suggest", exact: true }).click();
  await expect(board.locator('[data-suggested="from"]')).toBeVisible();
  await expect(board.locator('[data-suggested="to"]')).toBeVisible();
  await controls.getByRole("button", { name: "Suggest", exact: true }).click();
  const firstMoveRow = page.locator(".review-move-list li[data-review]").first();
  await expect(firstMoveRow).toBeVisible();
  await expect(firstMoveRow.locator(".review-move-side")).toHaveText("Wh");
  await expect(firstMoveRow.locator(".review-move-piece .piece-icon")).toHaveAttribute("data-code", "p");
  await expect(firstMoveRow.locator(".review-move-meta small")).toHaveText("e2-e4");

  const afterSuggestion = await board.boundingBox();
  expect(afterSuggestion?.width).toBeCloseTo(before!.width, 1);
  expect(afterSuggestion?.height).toBeCloseTo(before!.height, 1);

  await page.getByLabel("Board controls").getByRole("button", { name: "Reset" }).click();
  await page.getByLabel("Side").selectOption("first");
  await page.getByRole("button", { name: /Bot Mode/ }).last().click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByText(/1400-1500 Elo bot/i).first()).toBeVisible();
  await page.getByRole("button", { name: /e2.*pawn/i }).click();
  await page.getByRole("button", { name: "e4" }).click();
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 12000 });

  const afterBot = await board.boundingBox();
  expect(afterBot?.width).toBeCloseTo(before!.width, 1);
  expect(afterBot?.height).toBeCloseTo(before!.height, 1);
  expect(runtimeErrors).toEqual([]);
});

test("bot thinking time is charged to the bot clock", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic?mode=bot&bot=grandmaster&time=bullet");
  const blackClock = page.getByLabel("Black clock");
  await expect(blackClock).toHaveText("1:00");
  await page.getByLabel("Side").selectOption("first");
  await page.getByRole("button", { name: "Start Game" }).click();
  const before = clockSeconds(await blackClock.textContent());

  await page.getByRole("button", { name: /h2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "h3" }).click();
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 12000 });

  const after = clockSeconds(await blackClock.textContent());
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThanOrEqual(0);
  expect(runtimeErrors).toEqual([]);
});

test("play setup carries selected clock into game links", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play?mode=bot&time=blitz");
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();
  await expect(page.locator(".play-time-grid .is-selected")).toContainText("Blitz 5+0");
  await expect(page.getByLabel("Play modes")).toContainText("Bot Mode");
  await expect(page.getByLabel("Play modes")).not.toContainText("Matchmaking");

  const chooseGame = page.getByRole("button", { name: "Choose game" });
  await chooseGame.click();
  await expect(page.getByRole("dialog", { name: "Choose game" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Choose game" })).toHaveCount(0);
  await expect(chooseGame).toBeFocused();
  await chooseGame.click();
  await page.getByPlaceholder("Search games").fill("classic");
  const classicLink = page.getByRole("link", { name: /Classic Chess/ }).first();
  await expect(classicLink).toHaveAttribute("href", "/en/play/classic?bot=normal&mode=bot&time=blitz");
  await classicLink.click();

  await expect(page).toHaveURL(/\/en\/play\/classic\?bot=normal&mode=bot&time=blitz$/);
  await expect(page.getByLabel("Bot difficulty")).toHaveValue("elo-1400-1500");
  await expect(page.locator(".play-time-grid .is-selected")).toContainText("Blitz 5+0");
  expect(runtimeErrors).toEqual([]);
});

test("game picker exposes bot-capable preview variants without enabling live modes", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic?mode=bot&time=rapid");
  await page.getByRole("button", { name: "Choose game" }).click();
  await expect(page.getByLabel("Game filters")).toBeVisible();
  await page.getByLabel("Mode filter").getByRole("button", { name: "Bot", exact: true }).click();
  await page.getByPlaceholder("Search games").fill("shogi");
  const shogiLink = page.getByRole("link", { name: /Shogi.*Bot ready/i }).first();
  await expect(shogiLink).toHaveAttribute("href", "/en/play/shogi?bot=normal&mode=bot&time=rapid");
  await shogiLink.click();

  await expect(page).toHaveURL(/\/en\/play\/shogi\?bot=normal&mode=bot&time=rapid$/);
  await expect(page.getByRole("heading", { name: "Shogi" })).toBeVisible();
  await expect(page.getByLabel("Bot difficulty")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Play Online" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Play Online" })).toHaveAttribute("title", /Available for live and room setup/i);
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

test("setup flow supports Bot Mode as black with an automatic first reply", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play");
  await expect(page.getByRole("heading", { name: "Classic Chess" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();

  await page.goto("/en/play/classic?mode=bot&bot=normal");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();
  const before = await board.boundingBox();
  expect(before).toBeTruthy();

  await page.getByLabel("Side").selectOption("second");
  await page.getByLabel("Bot difficulty").first().selectOption("elo-2800-2900");
  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByText("Black side").first()).toBeVisible();
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/opening-book|internal-search|engine-search/)).toBeVisible();

  const after = await board.boundingBox();
  expect(after?.width).toBeCloseTo(before!.width, 1);
  expect(after?.height).toBeCloseTo(before!.height, 1);
  expect(runtimeErrors).toEqual([]);
});

test("classic grandmaster replies quickly with engine or bounded fallback", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic?mode=bot&bot=grandmaster");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();

  await page.getByLabel("Side").selectOption("first");
  await page.getByLabel("Bot difficulty").first().selectOption("elo-2800-2900");
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.getByRole("button", { name: /h2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "h3" }).click();

  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 7000 });
  await expect(page.getByText(/engine-search|internal-search/i)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("online setup disables bot controls and shows automatic ranked queue", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  await page.getByRole("button", { name: "Play Online" }).click();
  await expect(page.getByLabel("Bot difficulty")).toHaveCount(0);
  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByText("Searching for opponent").first()).toBeVisible();
  await expect(page.getByLabel("Online matchmaking status")).toContainText("Auto-matching opponent");
  await expect(page.getByLabel("Online matchmaking status")).toContainText("Rapid 10+0");
  await expect(page.getByLabel("Online matchmaking status")).toContainText("Ranked");
  await expect(page.getByLabel("Online queue details")).toContainText("Ticket");
  await expect(page.getByRole("button", { name: "Bot Mode" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apply move" })).toHaveCount(0);
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Suggest" })).toBeDisabled();
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Resign" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Online queue details")).toHaveCount(0);
  await expect(page.getByLabel("Play modes").getByRole("button", { name: "Play Online" })).toHaveClass(/is-selected/);
  await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("spectate mode is read-only after start", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  await page.getByLabel("Play modes").getByRole("button", { name: "Spectate" }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByText("Watching rooms").first()).toBeVisible();
  await expect(page.getByText("Spectate mode is read-only. Watch rooms without moving pieces.")).toBeVisible();

  await page.getByRole("button", { name: /e2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "e4" }).click();
  await expect(page.getByText("Spectate mode is read-only. Choose a playable mode to move pieces.")).toBeVisible();
  await expect(page.locator(".review-move-list")).not.toContainText("e4");
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Move", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Resign" })).toBeDisabled();
  expect(runtimeErrors).toEqual([]);
});

test("play chat keeps player and public rooms separate", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  const chat = page.getByLabel("Classic Chess chat room");
  await expect(chat).toBeVisible();
  await expect(chat.getByText("Private 1v1 room")).toBeVisible();

  await chat.getByPlaceholder("Message player room").fill("Good game");
  await chat.getByRole("button", { name: "Send players chat message" }).click();
  await expect(chat.getByText("Good game")).toBeVisible();

  await chat.getByRole("tab", { name: /Public/ }).click();
  await expect(chat.getByText("Spectator room")).toBeVisible();
  await expect(chat.getByText("Good game")).toHaveCount(0);
  await chat.getByPlaceholder("Message public room").fill("Watching here");
  await chat.getByRole("button", { name: "Send public chat message" }).click();
  await expect(chat.getByText("Watching here")).toBeVisible();

  await page.getByLabel("Play modes").getByRole("button", { name: "Spectate" }).click();
  const spectatorChat = page.getByLabel("Classic Chess chat room");
  await expect(spectatorChat.getByRole("tab", { name: /Players/ })).toBeDisabled();
  await expect(spectatorChat.getByText("Spectator room")).toBeVisible();
  await expect(spectatorChat.getByPlaceholder("Message public room")).toBeVisible();
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
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Resign" })).toBeEnabled();
  await page.getByLabel("Board controls").getByRole("button", { name: "Resign" }).click();

  const dialog = page.getByRole("dialog", { name: "Match over" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("resignation");
  await dialog.getByRole("button", { name: "Close match result" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByLabel("Board controls").getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Choose setup first")).toBeVisible();
  await expect(page.getByLabel("Play modes").getByRole("button", { name: "Offline Local" })).toHaveClass(/is-selected/);
  await page.getByRole("tab", { name: "Status" }).click();
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(page.getByLabel("Board controls").getByRole("button", { name: "Resign" })).toBeDisabled();
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
  await expect(board.locator('[data-terrain="palace"]')).toHaveCount(18);
  await expect(board.locator('[data-coordinate="d10"]')).toHaveAttribute("data-terrain", "palace");
  await expect(board.locator('[data-coordinate="d10"]')).toHaveAttribute("aria-label", /Palace/);
  await expect(page.getByLabel("Board terrain key")).toContainText("Palace");
  const coordinate = board.locator(".board-coordinate").first();
  await expect(coordinate).toBeVisible();
  await expect(coordinate).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).not.toHaveCSS("border-radius", "0px");
  await expect(coordinate).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).not.toHaveCSS("text-shadow", "none");

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

test("jungle board exposes river, den, and trap terrain", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/jungle");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();
  await expect(board.locator(".board-square")).toHaveCount(63);
  await expect(board.locator('[data-terrain="river"]')).toHaveCount(12);
  await expect(board.locator('[data-terrain="den"]')).toHaveCount(2);
  await expect(board.locator('[data-terrain="trap"]')).toHaveCount(10);
  await expect(board.locator('[data-coordinate="b6"]')).toHaveAttribute("data-terrain", "river");
  await expect(board.locator('[data-coordinate="d9"]')).toHaveAttribute("aria-label", /Den/);
  await expect(board.locator('[data-coordinate="c9"]')).toHaveAttribute("aria-label", /Trap/);
  const terrainKey = page.getByLabel("Board terrain key");
  await expect(terrainKey).toContainText("River");
  await expect(terrainKey).toContainText("Den");
  await expect(terrainKey).toContainText("Trap");
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test("drop-variant hand rails stay compact on Mini Shogi", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto("/en/play/mini-shogi");
  await expect(page.getByRole("heading", { name: "Mini Shogi" })).toBeVisible();
  await expect(page.getByLabel("Game board")).toBeVisible();

  const playerCard = page.getByLabel("Sente player card");
  await expect(playerCard.getByLabel("Sente hand: 0")).toBeVisible();
  await expect(playerCard.locator(".hand-tray")).toHaveAttribute("data-skin", "mini-wedge");
  await expect(playerCard.locator(".hand-tray-status")).toContainText("Hand");
  await expect(playerCard.locator(".hand-empty-pill")).toHaveText("0");
  const board = page.getByLabel("Game board");
  await expect(board.locator('[data-terrain="promotion-zone"]')).toHaveCount(10);
  await expect(board.locator('[data-coordinate="a5"]')).toHaveAttribute("data-terrain", "promotion-zone");
  await expect(board.locator('[data-coordinate="a5"]')).toHaveAttribute("aria-label", /Promotion zone/);
  await expect(page.getByLabel("Board terrain key")).toContainText("Promo zone");
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByText("Look").click();
  await page.getByLabel("Appearance set", { exact: true }).selectOption("tablet");
  await expect(page.getByLabel("Game board").locator(".piece-icon").first()).toHaveAttribute("data-skin", "tile");

  await page.getByRole("tab", { name: "Setup" }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await board.locator('[data-coordinate="e1"]').click();
  await board.locator('[data-coordinate="e4"]').click();
  await board.locator('[data-coordinate="a5"]').click();
  await board.locator('[data-coordinate="a4"]').click();

  await expect(playerCard.getByLabel("Sente hand: 1")).toBeVisible();
  await playerCard.getByRole("button", { name: /Drop Pawn, 1 in hand/i }).click();
  const dropHint = page.getByLabel("Dropping Pawn");
  await expect(dropHint).toBeVisible();
  await expect(dropHint).toContainText(/legal squares/);
  await expect(dropHint).toContainText("Nifu");
  await expect(dropHint.locator(".drop-piece-preview .piece-icon")).toHaveAttribute("data-code", "p");
  await dropHint.getByRole("button", { name: "Cancel Pawn drop" }).click();
  await expect(dropHint).toHaveCount(0);

  await page.getByLabel("Board controls").getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await board.locator('[data-coordinate="d1"]').click();
  await board.locator('[data-coordinate="b3"]').click();
  await board.locator('[data-coordinate="d5"]').click();
  await board.locator('[data-coordinate="d4"]').click();
  await board.locator('[data-coordinate="b3"]').click();
  await board.locator('[data-coordinate="d5"]').click();
  const promotionDialog = page.getByRole("dialog", { name: "Bishop promotion choice" });
  await expect(promotionDialog).toBeVisible();
  const promoteButton = promotionDialog.getByRole("button", { name: "Promote to Dragon Horse" });
  await expect(promoteButton).toBeVisible();
  await expect(promoteButton.locator(".piece-icon")).toHaveAttribute("data-promoted", "true");
  await expect(promotionDialog.getByRole("button", { name: "Keep Bishop" })).toBeVisible();
  await promotionDialog.getByRole("button", { name: "Keep Bishop" }).click();
  await expect(promotionDialog).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test("piece hover tooltips use localized piece names", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/ja/play/shogi");
  const pawnSquare = page.getByLabel(/sente \u6b69/).first();
  await expect(pawnSquare).toBeVisible();
  await pawnSquare.hover();
  const tooltipContent = await pawnSquare.evaluate((element) => getComputedStyle(element, "::after").content);

  expect(tooltipContent).toBe('"\u6b69"');
  expect(runtimeErrors).toEqual([]);
});

test("right-click planning arrows persist until normal play interaction", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1536, height: 864 });
  await page.goto("/en/play/classic");
  const board = page.getByLabel("Game board");
  await expect(board).toBeVisible();
  const bottomCard = page.getByLabel("White player card");
  await expect(bottomCard).toBeVisible();
  const firstViewportFit = await page.evaluate(() => ({ innerHeight, scrollHeight: document.documentElement.scrollHeight }));
  expect(firstViewportFit.scrollHeight).toBeLessThanOrEqual(firstViewportFit.innerHeight + 4);
  const previewChrome = await page.evaluate(() => {
    const preview = document.createElement("span");
    preview.className = "piece-drag-preview";
    document.body.appendChild(preview);
    const computed = getComputedStyle(preview);
    const styles = {
      backgroundColor: computed.backgroundColor,
      borderTopWidth: computed.borderTopWidth,
      boxShadow: computed.boxShadow
    };
    preview.remove();
    return styles;
  });
  expect(previewChrome).toEqual({ backgroundColor: "rgba(0, 0, 0, 0)", borderTopWidth: "0px", boxShadow: "none" });
  const draggingPieceOpacity = await page.evaluate(() => {
    const square = document.createElement("span");
    square.className = "board-square";
    square.dataset.dragging = "true";
    const piece = document.createElement("span");
    piece.className = "piece-icon";
    square.appendChild(piece);
    document.body.appendChild(square);
    const computed = getComputedStyle(piece);
    const styles = {
      opacity: computed.opacity,
      transform: computed.transform
    };
    square.remove();
    return styles;
  });
  expect(draggingPieceOpacity.opacity).toBe("0");
  expect(draggingPieceOpacity.transform).not.toBe("none");
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByText("Choose setup first")).toHaveCount(0);

  const e2Box = await board.locator('[data-coordinate="e2"]').boundingBox();
  const e3Box = await board.locator('[data-coordinate="e3"]').boundingBox();
  const e2PieceBox = await board.locator('[data-coordinate="e2"] .piece-icon').boundingBox();
  expect(e2Box).not.toBeNull();
  expect(e3Box).not.toBeNull();
  expect(e2PieceBox).not.toBeNull();
  if (e2Box && e3Box && e2PieceBox) {
    const dragStart = {
      x: e2Box.x + e2Box.width * 0.32,
      y: e2Box.y + e2Box.height * 0.68
    };
    const dragEnd = {
      x: e3Box.x + e3Box.width * 0.62,
      y: e3Box.y + e3Box.height * 0.4
    };
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 4 });
    await expect(page.locator(".board-drag-ghost")).toHaveCount(1);
    const ghost = await page.locator(".board-drag-ghost").evaluate((element) => {
      const computed = getComputedStyle(element);
      const piece = element.querySelector<HTMLElement>(".piece-icon");
      return {
        backgroundColor: computed.backgroundColor,
        borderTopWidth: computed.borderTopWidth,
        boxShadow: computed.boxShadow,
        left: Number.parseFloat(computed.left),
        pieceCode: piece?.dataset.code,
        top: Number.parseFloat(computed.top),
        width: Number.parseFloat(computed.width)
      };
    });
    const expectedOffset = {
      x: ((dragStart.x - e2PieceBox.x) / e2PieceBox.width) * ghost.width,
      y: ((dragStart.y - e2PieceBox.y) / e2PieceBox.height) * ghost.width
    };
    expect(ghost.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(ghost.borderTopWidth).toBe("0px");
    expect(ghost.boxShadow).toBe("none");
    expect(Math.abs(dragEnd.x - ghost.left - expectedOffset.x)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(dragEnd.y - ghost.top - expectedOffset.y)).toBeLessThanOrEqual(1.5);
    expect(ghost.pieceCode).toBe("p");
    expect(ghost.width).toBeGreaterThan(28);
    await page.mouse.up();
    await expect(page.locator(".board-drag-ghost")).toHaveCount(0);
  }

  await beginRightDragSquare(page, board, "e2", "e4");
  await expect(board.locator('[data-planning-preview="true"]')).toHaveCount(1);
  await page.mouse.up({ button: "right" });
  await expect(board.locator(".board-planning-layer line")).toHaveCount(1);

  await rightDragSquare(page, board, "g1", "f3");
  await rightDragSquare(page, board, "b1", "c3");
  await expect(board.locator(".board-planning-layer line")).toHaveCount(3);
  await page.mouse.click(12, 12);
  await expect(board.locator(".board-planning-layer line")).toHaveCount(0);

  await rightDragSquare(page, board, "g1", "f3");
  await rightDragSquare(page, board, "b1", "c3");
  await expect(board.locator(".board-planning-layer line")).toHaveCount(2);
  await board.locator('[data-coordinate="e2"]').click();
  await expect(board.locator(".board-planning-layer line")).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

async function rightDragSquare(page: import("@playwright/test").Page, board: import("@playwright/test").Locator, from: string, to: string) {
  await beginRightDragSquare(page, board, from, to);
  await page.mouse.up({ button: "right" });
}

async function beginRightDragSquare(page: import("@playwright/test").Page, board: import("@playwright/test").Locator, from: string, to: string) {
  const fromBox = await board.locator(`[data-coordinate="${from}"]`).boundingBox();
  const toBox = await board.locator(`[data-coordinate="${to}"]`).boundingBox();
  expect(fromBox).not.toBeNull();
  expect(toBox).not.toBeNull();
  if (!fromBox || !toBox) return;
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 8 });
}
