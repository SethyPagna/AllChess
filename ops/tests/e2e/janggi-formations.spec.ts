import { test, expect, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { board3DLayout, tabletopAspect, tabletopCameraPosition, tabletopCameraTarget, tabletopFieldOfView } from "../../../src/components/board/board-3d-config";

async function square(page: Page, key: string, occupied = false) {
  const camera = new PerspectiveCamera(tabletopFieldOfView, tabletopAspect, .01, 10);
  camera.position.set(...tabletopCameraPosition).multiplyScalar(board3DLayout("janggi", 10, 9).cameraScale);
  camera.lookAt(...tabletopCameraTarget); camera.updateMatrixWorld();
  const point = new Vector3((key.charCodeAt(0) - 97 - 4) * .053, occupied ? .012 : .003, (10 - Number(key.slice(1)) - 4.5) * .053).project(camera);
  const canvas = page.locator(".board-3d canvas"); await canvas.scrollIntoViewIfNeeded(); const b = (await canvas.boundingBox())!;
  await page.mouse.click(b.x + (point.x + 1) * b.width / 2, b.y + (1 - point.y) * b.height / 2);
}

test("local formations persist through clocks, 3D play, undo and saved reload", async ({ page }, info) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/en/play/janggi?mode=offline&time=freestyle");
  await page.getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "Red", exact: true }).click();
  await page.getByRole("region", { name: "Red Han formation" }).getByRole("button", { name: "Outer elephants", exact: true }).click();
  await expect(page.locator("[data-square='c1'] [data-code='h']")).toBeVisible();
  await page.getByRole("group", { name: "Formation side" }).getByRole("button", { name: "Cho", exact: true }).click();
  await page.getByRole("region", { name: "Blue Cho formation" }).getByRole("button", { name: "Left elephant", exact: true }).click();
  await expect(page.locator("[data-square='c10'] [data-code='h']")).toBeVisible();
  await page.getByRole("button", { name: "Rapid 10+0", exact: true }).click();
  await page.getByRole("button", { name: "Untimed", exact: true }).click();
  await expect(page.locator("[data-square='c10'] [data-code='h']")).toBeVisible();
  await page.locator(".janggi-local-setup").screenshot({ path: info.outputPath("formation-choices.png") });
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await page.getByRole("button", { name: "3D tiles", exact: true }).click();
  await expect(page.locator(".board-3d-status")).toContainText("Tap to move");
  await square(page, "c10", true); await square(page, "d8");
  await page.getByRole("button", { name: "2D board", exact: true }).click();
  await expect(page.locator("[data-square='d8'] [data-code='h'][data-owner='blue']")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("[data-square='c10'] [data-code='h']")).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await page.locator(".saved-matches summary").click();
  await page.getByRole("button", { name: "Resume", exact: true }).first().click();
  await expect(page.locator("[data-square='d8'] [data-code='h']")).toBeVisible();
  await expect(page.locator("[data-square='c1'] [data-code='h']")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const mode of ["room", "online"]) test(`${mode} confirms Han then Cho and reconstructs the chosen opening after reload`, async ({ browser, baseURL }, info) => {
  test.setTimeout(90000);
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 1440, height: 1000 } }), browser.newContext({ viewport: { width: 390, height: 844 } })]);
  const pages = await Promise.all(contexts.map(context => context.newPage())), errors: string[] = [];
  try {
    for (const page of pages) {
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${baseURL}/en/play/janggi?mode=${mode}`);
      await page.getByRole("button", { name: info.project.name === "mobile" ? "Classical 30+20" : "Rapid 10+0", exact: true }).click();
    }
    if (mode === "room") {
      await pages[0].getByRole("group", { name: "Side", exact: true }).getByRole("button", { name: "Red", exact: true }).click();
      await pages[0].getByRole("button", { name: "Create Room", exact: true }).click();
      await expect(pages[0]).toHaveURL(/room=[a-f0-9-]{36}/);
      await pages[1].goto(pages[0].url());
      await pages[1].getByRole("button", { name: "Join game", exact: true }).click();
    } else for (const page of pages) await page.getByRole("button", { name: "Find Match", exact: true }).click();
    for (const page of pages) await expect(page).toHaveURL(/room=[a-f0-9-]{36}/, { timeout: 30000 });
    const id = new URL(pages[0].url()).searchParams.get("room")!;
    expect(new URL(pages[1].url()).searchParams.get("room")).toBe(id);
    await expect(pages[0].locator(".janggi-formation-picker, .janggi-formation-wait")).toBeVisible();
    await expect(pages[1].locator(".janggi-formation-picker, .janggi-formation-wait")).toBeVisible();
    const tokens = await Promise.all(pages.map(page => page.evaluate(id => localStorage.getItem(`allchess-room-seat:${id}`), id)));
    async function read(index = 0) { const response = await contexts[index].request.post(`${baseURL}/api/friends/rooms/${id}`, { data: { action: "read", token: tokens[index] }, maxRetries: 2 }); expect(response.ok()).toBe(true); return (await response.json()).room; }
    const initial = await read(), redIndex = initial.seat === "red" ? 0 : 1, red = pages[redIndex], blue = pages[1 - redIndex];
    expect(initial.state.status).toBe("waiting"); const clocks = initial.state.clocks;
    await expect(blue.getByRole("button", { name: "Confirm formation", exact: true })).toHaveCount(0);
    await red.getByRole("region", { name: "Red Han formation" }).getByRole("button", { name: "Outer elephants", exact: true }).click();
    await red.getByRole("button", { name: "Confirm formation", exact: true }).click();
    await expect(blue.getByRole("region", { name: "Blue Cho formation" })).toBeVisible();
    await red.reload();
    await red.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(red.locator(".janggi-formation-wait")).toContainText("Cho");
    expect((await read()).state.clocks).toEqual(clocks);
    await blue.getByRole("region", { name: "Blue Cho formation" }).getByRole("button", { name: "Left elephant", exact: true }).click();
    await blue.locator(".janggi-formation-picker").screenshot({ path: info.outputPath(`${mode}-cho-setup.png`) });
    await blue.getByRole("button", { name: "Confirm formation", exact: true }).click();
    await expect(blue.locator(".room-live-status")).toContainText("Your turn");
    await blue.locator("[data-square='c10']").click(); await blue.locator("[data-square='d8']").click();
    await expect(red.locator("[data-square='d8'] [data-code='h']")).toBeVisible();
    await red.reload();
    await red.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(red.locator("[data-square='d8'] [data-code='h']")).toBeVisible();
    await red.getByRole("tab", { name: "Status", exact: true }).click();
    await red.getByRole("button", { name: "First move", exact: true }).click();
    await expect(red.locator("[data-square='c10'] [data-code='h']")).toBeVisible();
    await expect(red.locator("[data-square='c1'] [data-code='h']")).toBeVisible();
    await red.getByRole("button", { name: "Back to current", exact: true }).click();
    // Finish via the server's normal action, then accept a rematch in the UI.
    const live = await read();
    await contexts[redIndex].request.post(`${baseURL}/api/friends/rooms/${id}`, { data: { action: "resign", token: tokens[redIndex], gameId: live.state.id } });
    await expect(red.getByRole("button", { name: "Rematch · swap sides", exact: true })).toBeVisible();
    await red.getByRole("button", { name: "Rematch · swap sides", exact: true }).click();
    await blue.getByRole("button", { name: "Accept rematch · swap sides", exact: true }).click();
    await expect(blue.getByRole("region", { name: "Red Han formation" })).toBeVisible();
    await expect(red.locator(".janggi-formation-wait")).toContainText("Han");
    expect((await read()).state.status).toBe("waiting");
    for (const page of pages) expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
