import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

async function pair(request: APIRequestContext, time: string) {
  const tokens = [crypto.randomUUID(), crypto.randomUUID()];
  let roomId = "";
  for (const token of tokens) {
    const response = await request.post("/api/matchmaking/join", { data: { token, variantKey: "classic", timeControlKey: time } });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    if (body.match) roomId = body.match.roomId;
  }
  expect(roomId).toBeTruthy();
  return { roomId, tokens };
}
async function seat(context: BrowserContext, roomId: string, token: string) {
  await context.addInitScript(({ roomId, token }) => localStorage.setItem(`allchess-room-seat:${roomId}`, token), { roomId, token });
}

test("an unplayed match can cancel and find a new opponent without reviving the old room", async ({ page, context, request }, testInfo) => {
  const time = testInfo.project.name === "mobile" ? "classical" : "freestyle";
  const { roomId, tokens } = await pair(request, time);
  await seat(context, roomId, tokens[0]);
  await page.goto(`/en/play/classic?mode=room&room=${roomId}`);
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  const panel = page.getByRole("region", { name: "Match arrival" });
  await expect(panel).toContainText("Waiting for your opponent");
  await expect(panel.getByLabel("Arrival time remaining")).toContainText("s");
  await panel.getByRole("button", { name: "Cancel match", exact: true }).click();
  await expect(panel).toContainText("Match cancelled");
  await expect(page.getByRole("dialog", { name: "Match over" })).toHaveCount(0);
  const late = await request.post(`/api/friends/rooms/${roomId}`, { data: { action: "join", token: tokens[1] } });
  expect((await late.json()).room.arrival.status).toBe("cancelled");
  await page.reload();
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(panel).toContainText("Match cancelled");
  await panel.getByRole("button", { name: "Find another opponent", exact: true }).click();
  await expect(page).toHaveURL(/mode=online/);
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  // A different real participant joins the new search, without any state-injection route.
  const newcomer = crypto.randomUUID();
  await request.post("/api/matchmaking/join", { data: { token: newcomer, variantKey: "classic", timeControlKey: time } });
  await expect(page).toHaveURL(/room=[a-f0-9-]{36}/, { timeout: 15000 });
  const replacement = new URL(page.url()).searchParams.get("room")!;
  expect(replacement).not.toBe(roomId);
  await request.post(`/api/friends/rooms/${replacement}`, { data: { action: "join", token: newcomer } });
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".room-live-status")).toContainText("turn");
  const old = await request.post(`/api/friends/rooms/${roomId}`, { data: { action: "read", token: tokens[0] } });
  expect((await old.json()).room.arrival.status).toBe("cancelled");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("server deadline expires without charging clocks and offers a new setup", async ({ page, context, request }, testInfo) => {
  test.setTimeout(100000);
  const time = testInfo.project.name === "mobile" ? "blitz" : "rapid";
  const { roomId, tokens } = await pair(request, time);
  await seat(context, roomId, tokens[0]);
  await page.goto(`/en/play/classic?mode=room&room=${roomId}`);
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  const panel = page.getByRole("region", { name: "Match arrival" });
  await expect(panel).toContainText("Waiting for your opponent");
  await context.setOffline(true);
  await expect(panel).toContainText("Reconnecting");
  await expect(panel.getByLabel("Arrival time remaining")).toHaveCount(0);
  await context.setOffline(false);
  await expect(panel).toContainText("Match expired", { timeout: 70000 });
  const late = await request.post(`/api/friends/rooms/${roomId}`, { data: { action: "join", token: tokens[1] } });
  const body = await late.json();
  expect(body.room.arrival.status).toBe("expired");
  expect(body.room.state.clocks[0].remainingMs).toBe(time === "blitz" ? 300000 : 600000);
  expect(body.room.state.result).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath("arrival-expired.png"), fullPage: true });
  await panel.getByRole("button", { name: "Back to setup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Find Match", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("room")).toBe(false);
});
