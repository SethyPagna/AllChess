import { test, expect, type Page } from "@playwright/test";

test("Quick Match pairs protected seats and survives reload", async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    browser.newContext({ viewport: { width: 390, height: 844 } })
  ]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const moveRequests = [0, 0];
  try {
    for (const [index, page] of pages.entries()) {
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => {
        if (request.url().includes("/api/friends/rooms/") && request.postDataJSON()?.action === "move") moveRequests[index]++;
      });
      await page.goto(`${baseURL}/en/play/makruk?mode=online`);
      // Separate concurrent project runs into distinct clock queues.
      await page.getByRole("button", { name: testInfo.project.name === "mobile" ? "Classical 30+20" : "Untimed", exact: true }).click();
    }
    await pages[0].getByRole("button", { name: "Find Match", exact: true }).click();
    await pages[0].getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(pages[0].getByRole("button", { name: "Find Match", exact: true })).toBeVisible();
    for (const page of pages) await page.getByRole("button", { name: "Find Match", exact: true }).click();
    for (const page of pages) await expect(page).toHaveURL(/room=[a-f0-9-]{36}/, { timeout: 30000 });
    const id = new URL(pages[0].url()).searchParams.get("room")!;
    expect(new URL(pages[1].url()).searchParams.get("room")).toBe(id);
    const tokens = await Promise.all(pages.map(page => page.evaluate(id => localStorage.getItem(`allchess-room-seat:${id}`), id)));
    async function read() {
      const response = await contexts[0].request.post(`${baseURL}/api/friends/rooms/${id}`, { data: { action: "read", token: tokens[0] } });
      expect(response.ok()).toBe(true);
      return (await response.json()).room;
    }
    async function move(page: Page, from: string, to: string) {
      await page.locator(`[data-square="${from}"]`).click();
      await expect(page.locator(`[data-square="${from}"]`)).toHaveAttribute("data-square-state", "selected");
      await page.locator(`[data-square="${to}"]`).click();
    }
    const room = await read(), whiteIndex = room.seat === "white" ? 0 : 1;
    const white = pages[whiteIndex], black = pages[1 - whiteIndex];
    await expect(white.locator(".room-live-status")).toContainText("Your turn");
    await black.locator('[data-square="a3"]').click();
    await black.locator('[data-square="a4"]').click();
    expect((await read()).state.ply).toBe(0);
    expect(moveRequests[1 - whiteIndex]).toBe(0);
    await move(white, "a3", "a4");
    await expect(black.locator(".room-live-status")).toContainText("Your turn");
    expect((await read()).state.ply).toBe(1);
    await black.reload();
    await black.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(black.locator(".room-live-status")).toContainText("Your turn");
    await move(black, "a6", "a5");
    await expect(white.locator(".room-live-status")).toContainText("Your turn");
    expect((await read()).state.ply).toBe(2);
    await pages[1].screenshot({ path: testInfo.outputPath("matched-mobile.png"), fullPage: true });
    expect(await pages[1].evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
