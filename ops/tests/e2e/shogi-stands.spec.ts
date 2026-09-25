import { test, expect, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { board3DLayout } from "../../../src/components/board/board-3d-config";
import { tabletopFrame } from "../../../src/components/board/tabletop-camera";
import { shogiHandSlots } from "../../../src/components/board/shogi-stands";

async function tapPoint(page: Page, size: number, x: number, y: number, z: number) {
  const canvas = page.locator(".board-3d canvas"); await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  const frame = tabletopFrame("shogi", size, size, bounds.width, await page.evaluate(() => innerHeight));
  const camera = new PerspectiveCamera(frame.fieldOfView, frame.aspect, .01, 10);
  camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld();
  const point = new Vector3(x, y, z).project(camera);
  await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2);
}

async function square(page: Page, key: string, size: number, occupied = false, flipped = false) {
  const col = key.charCodeAt(0) - 97, row = size - Number(key.slice(1));
  const r = flipped ? size - 1 - row : row, c = flipped ? size - 1 - col : col;
  await tapPoint(page, size, (c - (size - 1) / 2) * .053, occupied ? .013 : .003, (r - (size - 1) / 2) * .057);
}

for (const size of [9, 5]) test(`${size}×${size} captured tiles drop directly from physical stands`, async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const key = size === 9 ? "shogi" : "mini-shogi", code = size === 9 ? "p" : "r", label = size === 9 ? "Pawn" : "Rook";
  await page.goto(`/en/play/${key}?mode=offline&time=freestyle`);
  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "Sente", exact: true }).click();
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await page.getByRole("button", { name: "3D tiles", exact: true }).click();
  await expect(page.locator(".board-3d-status")).toContainText("Tap to move");
  const moves = size === 9 ? [["e3", "e4"], ["a7", "a6"], ["e4", "e5"], ["a6", "a5"], ["e5", "e6"], ["a5", "a4"], ["e6", "e7"]] : [["a2", "a3"], ["e4", "e3"], ["a3", "a4"], ["e3", "e2"], ["a4", "a5"]];
  for (const [from, to] of moves) { await square(page, from, size, true); await square(page, to, size); }
  if (size === 9) await page.getByRole("button", { name: /^Promote to / }).click();
  await square(page, size === 9 ? "a4" : "e2", size, true); await square(page, size === 9 ? "a3" : "e1", size);
  if (size === 9) await page.getByRole("button", { name: /^Promote to / }).click();
  const sente = page.getByLabel("Sente player card", { exact: true }), gote = page.getByLabel("Gote player card", { exact: true });
  await expect(sente.getByRole("button", { name: `Drop ${label}, 1 in hand`, exact: true })).toBeEnabled();
  await expect(gote.getByRole("button", { name: `Held ${label}, 1 in hand`, exact: true })).toBeDisabled();
  const layout = board3DLayout("shogi", size, size), hands = { sente: { [code]: 1 }, gote: { [code]: 1 } };
  const compactHands = (await page.locator(".board-3d canvas").boundingBox())!.width < 520;
  const slots = shogiHandSlots(layout.width, layout.depth, hands, false, compactHands);
  const far = slots.find(slot => slot.owner === "gote")!;
  await tapPoint(page, size, far.x, .014, far.z);
  await expect(sente.locator(".hand-piece-button.is-selected")).toHaveCount(0);
  await expect(gote.locator(".hand-piece-button.is-selected")).toHaveCount(0);
  const near = slots.find(slot => slot.owner === "sente")!;
  await tapPoint(page, size, near.x, .014, near.z);
  await expect(sente.locator(".hand-piece-button.is-selected")).toHaveCount(1);
  await page.locator(".board-3d-stage").screenshot({ path: testInfo.outputPath("selected-stand.png") });
  // The occupied square must not consume the captured piece.
  await square(page, "a1", size, true);
  await expect(sente.locator("[data-piece-count='1']")).toHaveCount(1);
  const target = size === 9 ? "e3" : "b2";
  await square(page, target, size);
  await expect(sente.locator(".hand-piece-button")).toHaveCount(0);
  await page.getByRole("button", { name: "Rotate board", exact: true }).click();
  const flipped = shogiHandSlots(layout.width, layout.depth, { gote: { [code]: 1 } }, true, compactHands)[0];
  await tapPoint(page, size, flipped.x, .014, flipped.z);
  await expect(gote.locator(".hand-piece-button.is-selected")).toHaveCount(1);
  await square(page, size === 9 ? "a7" : "d4", size, false, true);
  await expect(gote.locator(".hand-piece-button")).toHaveCount(0);
  await page.getByRole("button", { name: "2D board", exact: true }).click();
  await expect(page.locator(`[data-square='${target}'] [data-code='${code}'][data-owner='sente']`)).toBeVisible();
  await expect(page.locator(`[data-square='${size === 9 ? "a7" : "d4"}'] [data-code='${code}'][data-owner='gote']`)).toBeVisible();
  await page.getByRole("button", { name: "3D tiles", exact: true }).click();
  await expect(page.locator(".board-3d-status")).toContainText("Tap to move");
  await page.locator(".board-3d-stage").screenshot({ path: testInfo.outputPath("empty-stands.png") });
  await page.getByRole("tab", { name: "Status", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^Review move ${size === 9 ? 8 : 6} `) }).click();
  for (const card of [sente, gote]) await expect(card.getByRole("button", { name: `Held ${label}, 1 in hand`, exact: true })).toBeDisabled();
  await tapPoint(page, size, flipped.x, .014, flipped.z);
  await expect(gote.locator(".hand-piece-button.is-selected")).toHaveCount(0);
  await page.getByRole("button", { name: "First move", exact: true }).click();
  for (const card of [sente, gote]) await expect(card.locator(".hand-piece-button")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to current", exact: true }).click();
  await page.locator(".board-3d-stage").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
