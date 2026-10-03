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

/** In-game action bar: Undo, Suggest, Draw, Resign, plus the "More game actions" menu. */
function boardControls(page: Page) {
  return page.getByLabel("Board controls", { exact: true });
}

async function openGameMenu(page: Page) {
  const controls = boardControls(page);
  await controls.getByLabel("More game actions", { exact: true }).click();
  const menu = controls.locator(".play-more-menu");
  await expect(menu).toBeVisible();
  return menu;
}

async function gameMenuAction(page: Page, name: string) {
  const menu = await openGameMenu(page);
  await menu.getByRole("button", { name, exact: true }).click();
  await expect(menu).toBeHidden();
}

function playModes(page: Page) {
  return page.getByRole("group", { name: "Play modes", exact: true });
}

function timeControlPicker(page: Page) {
  return page.getByLabel("Time control", { exact: true });
}

function movesPanel(page: Page) {
  return page.getByRole("region", { name: "Moves", exact: true });
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
  const controls = boardControls(page);
  await expect(controls).toBeVisible();
  await expect(controls).not.toContainText("Live");
  // Four everyday actions sit in the bar; everything else lives in the "More game actions" menu.
  await expect(controls.locator(":scope > button")).toHaveCount(4);
  await expect(controls.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await expect(controls.getByRole("button", { name: "Suggest a move", exact: true })).toBeEnabled();
  await expect(controls.getByRole("button", { name: "Apply move" })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Draw", exact: true })).toBeEnabled();
  await expect(controls.getByRole("button", { name: "Resign", exact: true })).toBeEnabled();
  const localMenu = await openGameMenu(page);
  for (const action of ["Redo", "Move for me", "Pause game", "Export game", "New game"]) await expect(localMenu.getByRole("button", { name: action, exact: true })).toBeVisible();
  await expect(localMenu.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
  // Offline Local is a two-player board: bot takeover is only offered in Bot Mode.
  await expect(localMenu.getByRole("button", { name: "Bot opponent" })).toHaveCount(0);
  await expect(localMenu.getByRole("button", { name: /^Auto/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(localMenu).toBeHidden();
  const matchDetails = page.getByLabel("Match details", { exact: true });
  await expect(matchDetails).toContainText("Offline Local");
  await expect(matchDetails).toContainText("Rapid 10+0");
  const moves = movesPanel(page);
  await expect(moves).toContainText("No moves yet");
  await expect(moves).not.toContainText("Live");
  const review = moves.getByLabel("Review playback controls");
  await expect(review.getByRole("button", { name: "First move" })).toBeDisabled();
  await expect(review.getByRole("button", { name: "Last move" })).toBeDisabled();
  const before = await board.boundingBox();
  expect(before).toBeTruthy();

  const firstPiece = board.locator(".piece-symbol").first();
  await expect(firstPiece).toBeVisible();
  await expect(firstPiece).toHaveCSS("opacity", "1");
  // Photographic pieces carry a soft drop shadow; anything that dims or blurs the piece is still a regression.
  const pieceFilter = await firstPiece.evaluate((element) => getComputedStyle(element).filter);
  expect(pieceFilter).toMatch(/^(none|drop-shadow\(.*\))$/);
  expect(pieceFilter).not.toMatch(/grayscale|opacity|brightness|blur|saturate/);
  await expect(board.locator('[data-piece="king"]').first()).toBeVisible();
  await expect(board.locator('[data-piece="queen"]').first()).toBeVisible();
  const coordinate = board.locator(".board-coordinate").first();
  await expect(coordinate).toBeVisible();
  await expect(coordinate).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).toHaveCSS("box-shadow", "none");
  await expect(coordinate).toHaveCSS("border-radius", "0px");
  await expect(coordinate).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).toHaveCSS("text-shadow", "none");
  const firstFileLabel = (await board.locator(".board-file").first().textContent())?.trim() ?? "";
  const firstFileDataLabel = await board.locator(".board-file").first().getAttribute("data-coordinate-label");
  expect(firstFileLabel).toMatch(/^[a-z]$/);
  expect(firstFileDataLabel).toBe(firstFileLabel);
  await expect(page.getByLabel("Black player card")).not.toHaveCSS("background-color", "rgb(36, 35, 31)");

  await controls.getByRole("button", { name: "Suggest a move", exact: true }).click();
  await expect(board.locator('[data-suggested="from"]')).toBeVisible();
  await expect(board.locator('[data-suggested="to"]')).toBeVisible();
  await expect(page.locator("p.play-note")).toContainText("Hint:");
  await controls.getByRole("button", { name: "Play suggested move", exact: true }).click();
  await expect(page.getByText("Suggestion applied.")).toBeVisible();
  const firstMove = moves.getByRole("button", { name: /^Move 1: / });
  await expect(firstMove).toBeVisible();
  // White's opening pawn push; accept both route ("e2-e4") and SAN ("e4") notation.
  await expect(firstMove).toHaveAccessibleName(/^Move 1: Pawn (e2-)?e4$/);
  const movedPawn = board.locator('[data-coordinate="e4"] .piece-icon');
  await expect(movedPawn).toHaveAttribute("data-code", "p");
  await expect(movedPawn).toHaveAttribute("data-owner", "white");
  await expect(firstMove).toHaveAttribute("data-latest", "true");
  await expect(moves.locator(".move-no").first()).toHaveText("1");
  await expect(moves.locator(".move-pairs")).toHaveCSS("overflow-y", "auto");
  await expect(moves).not.toContainText("Info");
  await expect(controls.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();

  const afterSuggestion = await board.boundingBox();
  expect(afterSuggestion?.width).toBeCloseTo(before!.width, 1);
  expect(afterSuggestion?.height).toBeCloseTo(before!.height, 1);

  await gameMenuAction(page, "New game");
  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "White", exact: true }).click();
  await playModes(page).getByRole("button", { name: "Bot Mode", exact: true }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByText(/1400-1500 Elo bot/i).first()).toBeVisible();
  await expect(matchDetails).toContainText("Bot Mode");
  await expect(matchDetails).toContainText("1400-1500 Elo");
  const botMenu = await openGameMenu(page);
  await expect(botMenu.getByRole("button", { name: /^Bot opponent/ })).toHaveAttribute("aria-pressed", "true");
  await expect(botMenu.getByRole("button", { name: /^Bot opponent/ })).toBeEnabled();
  await expect(botMenu.getByRole("button", { name: "Auto · bots play both sides", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(botMenu).toBeHidden();
  await page.getByRole("button", { name: /e2.*pawn/i }).click();
  await page.getByRole("button", { name: "e4" }).click();
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 12000 });

  const afterBot = await board.boundingBox();
  expect(afterBot?.width).toBeCloseTo(before!.width, 1);
  expect(afterBot?.height).toBeCloseTo(before!.height, 1);
  expect(runtimeErrors).toEqual([]);
});

test("Janggi pass records a move and respects pause and review", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/janggi?mode=offline&time=freestyle");
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  const pass = boardControls(page).getByRole("button", { name: "Pass turn", exact: true });
  const board = page.getByLabel("Game board", { exact: true });
  const position = await board.locator(".board-square").evaluateAll((squares) => squares.map((square) => square.getAttribute("aria-label")));
  await expect(pass).toBeEnabled();
  await pass.click();
  await expect(movesPanel(page).getByRole("button", { name: /^Move 1:.*Pass$/ })).toBeVisible();
  expect(await board.locator(".board-square").evaluateAll((squares) => squares.map((square) => square.getAttribute("aria-label")))).toEqual(position);
  await expect(pass).toBeEnabled();

  await gameMenuAction(page, "Pause game");
  await expect(pass).toBeDisabled();
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  await expect(pass).toBeEnabled();
  await movesPanel(page).getByRole("button", { name: "First move", exact: true }).click();
  await expect(pass).toBeDisabled();
  await movesPanel(page).getByRole("button", { name: "Last move", exact: true }).click();
  await expect(pass).toBeEnabled();
  await boardControls(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(movesPanel(page)).toContainText("No moves yet");
  await expect(pass).toBeEnabled();
  await expectNoHorizontalOverflow(page);
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
  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "White", exact: true }).click();
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
  await expect(timeControlPicker(page)).toContainText("Blitz 5+0");
  await expect(playModes(page).getByRole("button", { name: "Bot Mode", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(playModes(page)).not.toContainText("Matchmaking");

  const chooseGame = page.getByRole("button", { name: /^Classic Chess\s*, choose game$/ });
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
  await expect(page.getByLabel("Bot difficulty", { exact: true })).toContainText("1400-1500 Elo");
  await expect(timeControlPicker(page)).toContainText("Blitz 5+0");
  expect(runtimeErrors).toEqual([]);
});

test("game picker carries bot mode into Shogi with supported live modes", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic?mode=bot&time=rapid");
  await page.getByRole("button", { name: /^Classic Chess\s*, choose game$/ }).click();
  await expect(page.getByLabel("Game filters")).toBeVisible();
  await page.getByLabel("Mode filter").getByRole("button", { name: "Bot", exact: true }).click();
  await page.getByPlaceholder("Search games").fill("shogi");
  const shogiLink = page.getByRole("link", { name: /Shogi.*Bot ready/i }).first();
  await expect(shogiLink).toHaveAttribute("href", "/en/play/shogi?bot=normal&mode=bot&time=rapid");
  await shogiLink.click();

  await expect(page).toHaveURL(/\/en\/play\/shogi\?bot=normal&mode=bot&time=rapid$/);
  await expect(page.getByRole("heading", { name: "Shogi" })).toBeVisible();
  await expect(page.getByLabel("Bot difficulty", { exact: true })).toBeVisible();
  await expect(playModes(page).getByRole("button", { name: "Bot Mode", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Enabled modes carry their own label as the tooltip; disabled ones would show the catalog lock reason instead.
  await expect(playModes(page).getByRole("button", { name: "Quick Match", exact: true })).toBeEnabled();
  await expect(playModes(page).getByRole("button", { name: "Quick Match", exact: true })).toHaveAttribute("title", "Quick Match");
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

  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "Black", exact: true }).click();
  await page.getByLabel("Bot difficulty", { exact: true }).first().click();
  await page.getByRole("group", { name: "Bot difficulty options" }).getByRole("button", { name: "2800-2900 Elo", exact: true }).click();
  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByLabel("Black player card", { exact: true })).toContainText("You");
  await expect(page.getByLabel("White player card", { exact: true })).toContainText("2800-2900 Elo bot");
  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 5000 });
  // The engine source is no longer surfaced; the bot's white opening must land in the move list instead.
  await expect(movesPanel(page).getByRole("button", { name: /^Move 1: / })).toBeVisible();
  await expect(page.getByLabel("Match details", { exact: true })).toContainText("2800-2900 Elo");

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

  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "White", exact: true }).click();
  await page.getByLabel("Bot difficulty", { exact: true }).first().click();
  await page.getByRole("group", { name: "Bot difficulty options" }).getByRole("button", { name: "2800-2900 Elo", exact: true }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.getByRole("button", { name: /h2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "h3" }).click();

  await expect(page.getByText("Bot replied automatically.")).toBeVisible({ timeout: 7000 });
  // Engine source labels are no longer displayed; the reply must be recorded as move 2.
  await expect(movesPanel(page).getByRole("button", { name: /^Move 1: Pawn (h2-)?h3$/ })).toBeVisible();
  await expect(movesPanel(page).getByRole("button", { name: /^Move 2: / })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("online setup disables bot controls and shows automatic casual queue", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  const quickMatch = playModes(page).getByRole("button", { name: "Quick Match", exact: true });
  await quickMatch.click();
  await expect(quickMatch).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Bot difficulty")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Side", exact: true })).toHaveCount(0);
  await expect(page.getByText("Casual game · sides are assigned when paired")).toBeVisible();
  await expect(page.getByRole("button", { name: "Find Match" })).toBeVisible();
  await page.getByRole("button", { name: "Find Match" }).click();

  await expect(page.locator("p.play-note")).toContainText("Finding an opponent for a casual game.");
  const status = page.getByLabel("Online matchmaking status", { exact: true });
  await expect(status).toContainText("Finding an opponent");
  await expect(status).toContainText("Rapid 10+0");
  await expect(status).toContainText("casual");
  await expect(status).toContainText("Ticket");
  await expect(page.getByLabel("Match details", { exact: true })).toContainText("Quick Match");
  // Setup (and with it Bot Mode) is locked away while the queue runs.
  await expect(playModes(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bot Mode" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Apply move" })).toHaveCount(0);
  await expect(boardControls(page).getByRole("button", { name: "Suggest a move" })).toBeDisabled();
  await expect(boardControls(page).getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(boardControls(page).getByRole("button", { name: "Resign" })).toBeDisabled();
  const onlineMenu = await openGameMenu(page);
  await expect(onlineMenu.getByRole("button", { name: "Bot opponent" })).toHaveCount(0);
  await expect(onlineMenu.getByRole("button", { name: "Move for me", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await status.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(status).toHaveCount(0);
  await expect(quickMatch).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Find Match" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("friend room setup creates invite-ready status without matchmaking copy", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic");
  const friendMode = playModes(page).getByRole("button", { name: "Play a Friend", exact: true });
  await friendMode.click();
  await expect(friendMode).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Bot difficulty")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create Room" })).toBeVisible();
  await page.getByRole("button", { name: "Create Room" }).click();

  const status = page.getByLabel("Online matchmaking status", { exact: true });
  await expect(status).toContainText("Room ready");
  await expect(page).toHaveURL(/room=[a-f0-9-]{36}/);
  const roomId = new URL(page.url()).searchParams.get("room")!;
  await expect(page.getByRole("status").filter({ hasText: "Waiting for your friend · share the invite link" })).toBeVisible();
  await expect(status).toContainText("Use Share to send the invite link.");
  await expect(page.getByLabel("Match details", { exact: true })).toContainText("Play a Friend");
  await expect(page.getByText(/Finding an opponent|Searching for opponent/)).toHaveCount(0);
  await expect(status.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await page.getByRole("button", { name: "Share game" }).click();
  await expect(page.getByRole("dialog", { name: "Share game options" }).getByText(roomId)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Share game options" }).getByRole("link", { name: /Invite link/ })).toHaveAttribute("href", new RegExp(`room=${roomId}`));
  await expect(boardControls(page).getByRole("button", { name: "Suggest a move" })).toBeDisabled();
  await expect(boardControls(page).getByRole("button", { name: "Draw" })).toBeDisabled();
  expect(runtimeErrors).toEqual([]);
});

test("spectate mode is read-only after start", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  await page.goto("/en/play/classic?mode=spectate");
  await expect(page.getByRole("button", { name: "Start Watching" })).toBeVisible();
  await page.getByRole("button", { name: "Start Watching" }).click();
  await expect(page.getByLabel("Match details", { exact: true })).toContainText("Spectate");
  await expect(page.getByText("Spectate mode is read-only. Watch rooms without moving pieces.")).toBeVisible();

  await page.getByRole("button", { name: /e2.*white.*pawn/i }).click();
  await page.getByRole("button", { name: "e4", exact: true }).click();
  await expect(page.getByText("Spectate mode is read-only. Choose a playable mode to move pieces.")).toBeVisible();
  await expect(movesPanel(page)).toContainText("No moves yet");
  await expect(movesPanel(page).getByRole("button", { name: /^Move \d+:/ })).toHaveCount(0);
  // Spectators get no move, draw or resign actions at all.
  await expect(boardControls(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Move for me" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Draw", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resign", exact: true })).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test("play chat keeps player and public rooms separate", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });

  // Chat only exists once a live game is running: queue for a Daily game (a quiet pool) to reach the players room.
  await page.goto("/en/play/classic?mode=online&time=correspondence");
  await expect(timeControlPicker(page)).toContainText("Daily");
  await page.getByRole("button", { name: "Find Match" }).click();
  const status = page.getByLabel("Online matchmaking status", { exact: true });
  await expect(status).toContainText("Finding an opponent");
  const chat = page.getByLabel("Classic Chess chat room");
  await page.locator(".studio-chat-disclosure > summary").click();
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

  await status.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(status).toHaveCount(0);
  await page.goto("/en/play/classic?mode=spectate");
  await page.getByRole("button", { name: "Start Watching" }).click();
  await page.locator(".studio-chat-disclosure > summary").click();
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
  await expect(boardControls(page).getByRole("button", { name: "Resign" })).toBeEnabled();
  await boardControls(page).getByRole("button", { name: "Resign" }).click();

  const dialog = page.getByRole("dialog", { name: "Match over" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("resignation");
  await dialog.getByRole("button", { name: "Close match result" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(boardControls(page).getByRole("button", { name: "Draw" })).toBeDisabled();
  await expect(boardControls(page).getByRole("button", { name: "Resign" })).toBeDisabled();

  await gameMenuAction(page, "New game");
  await expect(playModes(page).getByRole("button", { name: "Offline Local", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Back in setup: the in-game action bar is gone until the next start.
  await expect(boardControls(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Draw", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resign", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Game", exact: true })).toBeVisible();
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
  await expect(board.locator('[data-coordinate="e9"]')).toHaveAttribute("aria-label", /Palace/);
  const coordinate = board.locator(".board-coordinate").first();
  await expect(coordinate).toBeVisible();
  await expect(coordinate).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).toHaveCSS("border-radius", "0px");
  await expect(coordinate).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(coordinate).toHaveCSS("text-shadow", "none");
  await expect(board.locator(".board-file").first()).toHaveText("a");
  await expect(board.locator(".board-file").first()).toHaveCSS("text-transform", "lowercase");

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
  // Standard rules: three traps around each den (the old 10-trap layout only survives in legacy saves).
  await expect(board.locator('[data-terrain="trap"]')).toHaveCount(6);
  await expect(board.locator('[data-coordinate="d8"]')).toHaveAttribute("data-terrain", "trap");
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
  await expect(playerCard.getByRole("group", { name: "Sente hand empty", exact: true })).toBeAttached();
  await expect(playerCard.locator(".hand-tray")).toHaveAttribute("data-skin", "mini-wedge");
  await expect(playerCard.locator(".hand-tray")).toHaveClass(/sr-only/);
  await expect(playerCard.locator(".hand-tray").getByRole("button")).toHaveCount(0);
  const board = page.getByLabel("Game board");
  await expect(board.locator('[data-terrain="promotion-zone"]')).toHaveCount(10);
  await expect(board.locator('[data-coordinate="a5"]')).toHaveAttribute("data-terrain", "promotion-zone");
  await expect(board.locator('[data-coordinate="a5"]')).toHaveAttribute("aria-label", /Promotion zone/);
  await expect(board.locator('[data-coordinate="a1"]')).toHaveAttribute("aria-label", /Promotion zone/);
  // The old "Tablets" appearance set is now the "Letters" 2D piece style inside the Customize board popover.
  await page.getByLabel("Customize board", { exact: true }).click();
  const pieceStyle = page.getByRole("group", { name: "2D piece style", exact: true });
  await pieceStyle.getByRole("button", { name: "Use Letters pieces", exact: true }).click();
  await expect(pieceStyle.getByRole("button", { name: "Use Letters pieces", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Game board").locator(".piece-icon").first()).toHaveAttribute("data-skin", "tile");
  await page.keyboard.press("Escape");
  await expect(pieceStyle).toBeHidden();

  await page.getByRole("button", { name: "Start Game" }).click();
  await board.locator('[data-coordinate="e1"]').click();
  await board.locator('[data-coordinate="e4"]').click();
  await board.locator('[data-coordinate="d5"]').click();
  await board.locator('[data-coordinate="e4"]').click();
  await expect(movesPanel(page).getByRole("button", { name: /^Move 2: Gold General d5xe4$/ })).toBeVisible();

  await expect(playerCard.getByRole("group", { name: "Sente hand pieces", exact: true })).toBeVisible();
  await expect(playerCard.locator(".hand-tray")).not.toHaveClass(/sr-only/);
  await expect(playerCard.getByRole("button", { name: /Drop Pawn, 1 in hand/i })).toHaveAttribute("data-piece-count", "1");
  await playerCard.getByRole("button", { name: /Drop Pawn, 1 in hand/i }).click();
  const dropHint = page.getByLabel("Dropping Pawn");
  await expect(dropHint).toBeVisible();
  await expect(dropHint).toContainText(/legal squares/);
  await expect(dropHint).toContainText("Nifu");
  await expect(dropHint.locator(".drop-piece-preview .piece-icon")).toHaveAttribute("data-code", "p");
  await dropHint.getByRole("button", { name: "Cancel Pawn drop" }).click();
  await expect(dropHint).toHaveCount(0);

  await gameMenuAction(page, "New game");
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
  expect(e2Box).not.toBeNull();
  expect(e3Box).not.toBeNull();
  if (e2Box && e3Box) {
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
        transform: computed.transform,
        width: Number.parseFloat(computed.width)
      };
    });
    expect(ghost.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(ghost.borderTopWidth).toBe("0px");
    expect(ghost.boxShadow).toBe("none");
    expect(ghost.transform).not.toBe("none");
    expect(Math.abs(dragEnd.x - ghost.left)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(dragEnd.y - ghost.top)).toBeLessThanOrEqual(1.5);
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
