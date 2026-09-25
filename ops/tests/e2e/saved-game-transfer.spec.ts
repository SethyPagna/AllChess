import { test, expect, type Page, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function file(download: Download) {
  return { name: download.suggestedFilename(), mimeType: "application/json", buffer: await readFile((await download.path())!) };
}
async function records(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("allchess-local-matches", 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return new Promise<Array<{ id: string; payload: string }>>((resolve, reject) => { const request = db.transaction("matches").objectStore("matches").getAll(); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; });
  });
}
async function openSaves(page: Page) {
  const saved = page.locator(".saved-matches").first();
  if (!(await saved.evaluate(element => (element as HTMLDetailsElement).open))) await saved.locator("summary").click();
  return saved;
}

test("download and import on a fresh device preserve Janggi formations and redo without replacing saves", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/en/play/janggi?mode=offline&time=freestyle");
  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "Red", exact: true }).click();
  await page.getByRole("region", { name: "Red Han formation" }).getByRole("button", { name: "Outer elephants", exact: true }).click();
  await page.getByRole("group", { name: "Formation side" }).getByRole("button", { name: "Cho", exact: true }).click();
  await page.getByRole("region", { name: "Blue Cho formation" }).getByRole("button", { name: "Left elephant", exact: true }).click();
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await page.locator("[data-square='c10']").click(); await page.locator("[data-square='d8']").click();
  await expect(page.locator("[data-square='d8'] [data-code='h']")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const downloading = page.waitForEvent("download"); await page.getByRole("button", { name: "Export game", exact: true }).click();
  const backup = await file(await downloading);
  expect(backup.name).toMatch(/^allchess-janggi-.*\.allchess\.json$/);
  const original = JSON.parse(backup.buffer.toString());
  await expect.poll(async () => (await records(page)).length).toBe(1);
  await page.reload(); const existing = await openSaves(page);
  const rowDownloading = page.waitForEvent("download"); await existing.getByRole("button", { name: /^Export .* game$/ }).click();
  expect(JSON.parse((await file(await rowDownloading)).buffer.toString()).game).toEqual(original.game);
  const context = await browser.newContext({ viewport: page.viewportSize() }); const other = await context.newPage();
  other.on("pageerror", error => errors.push(error.message));
  try {
    // A different variant's saved-games panel must still open the imported game's route.
    await other.goto(`${baseURL}/en/play/classic?mode=offline&time=freestyle`);
    const saved = await openSaves(other);
    const choosing = other.waitForEvent("filechooser"); await saved.getByRole("button", { name: "Import game", exact: true }).click();
    await (await choosing).setFiles(backup);
    await expect(saved.getByRole("status")).toContainText("Imported as a separate copy");
    const firstLink = await saved.getByRole("link", { name: "Open imported game" }).getAttribute("href");
    expect(firstLink).toContain("/play/janggi?mode=offline&resume="); expect(firstLink).not.toContain(original.game.id);
    const firstRecord = await records(other);
    await saved.getByLabel("AllChess game file").setInputFiles(backup);
    await expect.poll(async () => (await records(other)).length).toBe(2);
    const importedRecords = await records(other);
    expect(importedRecords.find(row => row.id === firstRecord[0].id)).toEqual(firstRecord[0]);
    expect(new Set(importedRecords.map(row => row.id)).size).toBe(2);
    await expect(saved.getByRole("link", { name: "Open imported game" })).not.toHaveAttribute("href", firstLink!);
    await saved.screenshot({ path: info.outputPath("imported-game.png") });
    await saved.getByRole("link", { name: "Open imported game" }).click();
    await expect(other.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
    await expect(other.locator("[data-square='c10'] [data-code='h']")).toBeVisible();
    await expect(other.locator("[data-square='c1'] [data-code='h']")).toBeVisible();
    await other.getByRole("button", { name: "Resume game", exact: true }).click();
    await other.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(other.locator("[data-square='d8'] [data-code='h']")).toBeVisible();
    await other.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(other.locator("[data-square='c10'] [data-code='h']")).toBeVisible();
    expect(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("invalid imports and unavailable storage leave existing saves untouched", async ({ page }) => {
  await page.goto("/en/play/classic?mode=offline&time=freestyle");
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const downloading = page.waitForEvent("download"); await page.getByRole("button", { name: "Export game", exact: true }).click(); const backup = await file(await downloading);
  await expect.poll(async () => (await records(page)).length).toBe(1);
  await page.reload(); const saved = await openSaves(page), original = await records(page);
  await saved.getByLabel("AllChess game file").setInputFiles({ name: "broken.allchess.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await expect(saved.getByRole("alert")).toContainText("not a readable");
  expect(await records(page)).toEqual(original);
  await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException("Test storage limit", "QuotaExceededError"); }; });
  await saved.getByLabel("AllChess game file").setInputFiles(backup);
  await expect(saved.getByRole("alert")).toContainText("Existing saves are unchanged");
  expect(await records(page)).toEqual(original);
  await expect(saved.getByRole("link", { name: "Open imported game" })).toHaveCount(0);
});

test("the open board exports the current position even when autosave cannot write", async ({ page, browser, baseURL }) => {
  await page.addInitScript(() => { IDBObjectStore.prototype.put = () => { throw new DOMException("Test storage limit", "QuotaExceededError"); }; });
  await page.goto("/en/play/classic?mode=offline&time=freestyle");
  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "White", exact: true }).click();
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await page.locator("[data-square='e2']").click(); await page.locator("[data-square='e4']").click();
  await expect(page.getByRole("button", { name: "Retry save", exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download"); await page.getByRole("button", { name: "Export game", exact: true }).click(); const backup = await file(await downloading);
  expect(await records(page)).toHaveLength(0);
  const context = await browser.newContext({ viewport: page.viewportSize() }); const other = await context.newPage();
  try {
    await other.goto(`${baseURL}/en/play/classic?mode=offline`); const saved = await openSaves(other);
    await saved.getByLabel("AllChess game file").setInputFiles(backup);
    await saved.getByRole("link", { name: "Open imported game" }).click();
    await expect(other.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
    await expect(other.locator("[data-square='e4'] [data-code='p'][data-owner='white']")).toBeVisible();
  } finally { await context.close(); }
});
