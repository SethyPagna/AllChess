import { test, expect, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { createInitialState, applyMove, type GameState } from "../../../src/lib/variants";
import { exportLocalMatch } from "../../../src/lib/game/local-match-transfer";
import { botDifficultyLevels } from "../../../src/lib/bot/config";
import { board3DLayout, tabletopAspect, tabletopCameraPosition, tabletopCameraTarget, tabletopFieldOfView } from "../../../src/components/board/board-3d-config";

async function tap(page: Page, key: string, size: number, height = .003, flipped = false) {
  const layout = board3DLayout("draughts", size, size), camera = new PerspectiveCamera(tabletopFieldOfView, tabletopAspect, .01, 10);
  camera.position.set(...tabletopCameraPosition).multiplyScalar(layout.cameraScale); camera.lookAt(...tabletopCameraTarget); camera.updateMatrixWorld();
  const col = key.charCodeAt(0) - 97, row = size - Number(key.slice(1));
  const point = new Vector3(((flipped ? size-1-col : col) - (size-1)/2)*layout.pitchX, height, ((flipped ? size-1-row : row) - (size-1)/2)*layout.pitchZ).project(camera);
  const canvas = page.locator(".board-3d canvas"); await canvas.scrollIntoViewIfNeeded(); const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x+(point.x+1)*box.width/2, box.y+(1-point.y)*box.height/2);
}
async function openPosition(page: Page, state: GameState) {
  const file = exportLocalMatch({ state, history: [], future: [], settings: { playMode: "offline", botMode: "human", botDifficulty: botDifficultyLevels[0].key, timeControl: "freestyle", humanColor: "white", seatChoice: "first", boardOrientation: "first" } });
  await page.goto(`/en/play/${state.variantKey}?mode=offline&time=freestyle`);
  await page.locator(".saved-matches summary").click();
  await page.getByLabel("AllChess game file").setInputFiles({ name: file.filename, mimeType: "application/json", buffer: Buffer.from(file.contents) });
  await page.getByRole("link", { name: "Open imported game" }).click();
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
}
function empty(key: string) {
  const state = createInitialState(key); state.board.flat().forEach(cell => { cell.piece = null; });
  state.clocks.forEach(clock => { clock.remainingMs = 0; clock.incrementMs = 0; }); return state;
}
function put(state: GameState, row: number, col: number, owner: "white" | "black") {
  state.board[row][col].piece = { id: `${owner}-${row}-${col}`, code: "p", owner, labelKey: "chess.pawn" };
}

for (const key of ["english-draughts", "international-draughts", "turkish-draughts"]) test(`${key} crowns both sides into movable physical stacks`, async ({ page }, info) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const state = empty(key), size = state.board.length, turkish = key === "turkish-draughts";
  put(state, 1, 2, "white"); put(state, size-2, 5, "black"); put(state, 4, 7, "white"); put(state, 3, 0, "black");
  await openPosition(page, state);
  await expect(page.locator(".board-grid")).toHaveAttribute("data-board-geometry", turkish ? "plain-grid" : "checkered");
  await page.getByRole("button", { name: "3D counters", exact: true }).click();
  await expect(page.locator(".board-3d-status")).toContainText("Tap to move", { timeout: 20000 });
  const whiteCrown = `${turkish ? "c" : "b"}${size}`, blackCrown = `${turkish ? "f" : "e"}1`;
  await tap(page, `c${size-1}`, size, .013); await tap(page, whiteCrown, size);
  await tap(page, "f2", size, .013); await tap(page, blackCrown, size);
  await page.getByRole("button", { name: "2D board", exact: true }).click();
  for (const square of [whiteCrown, blackCrown]) await expect(page.locator(`[data-square='${square}'] [data-piece='checker-king']`)).toBeVisible();
  await page.getByRole("button", { name: "3D counters", exact: true }).click(); await expect(page.locator(".board-3d-status")).toContainText("Tap to move", { timeout: 20000 });
  for (const finish of ["Porcelain", "Slate", "Maple & wenge"]) await page.getByRole("button", { name: finish, exact: true }).click();
  await page.locator(".board-3d-stage").screenshot({ path: info.outputPath(`${key}-kings.png`) });
  // Camera movement must not count as a move or lose the selectable king.
  const canvas = page.locator(".board-3d canvas"); await canvas.scrollIntoViewIfNeeded(); const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5); await page.mouse.down(); await page.mouse.move(b.x+b.width*.62,b.y+b.height*.53,{steps:8}); await page.mouse.up(); await page.mouse.wheel(0,-80);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByRole("button", { name: "Rotate board", exact: true }).click();
  const target = `c${size-(turkish ? 2 : 1)}`;
  await tap(page, whiteCrown, size, .024, true); await tap(page, target, size, .003, true);
  await page.getByRole("button", { name: "2D board", exact: true }).click();
  await expect(page.locator(`[data-square='${target}'] [data-piece='checker-king'][data-owner='white']`)).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(`[data-square='${whiteCrown}'] [data-piece='checker-king']`)).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "3D counters", exact: true }).click(); await page.getByRole("button", { name: "Porcelain", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click(); await page.reload();
  await expect(page.getByRole("button", { name: "Resume game", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Porcelain", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".board-3d-status")).toContainText("Tap to move", { timeout: 20000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test("a restored capture chain keeps the same counter selected for its next 3D jump", async ({ page }) => {
  const state = empty("english-draughts");
  put(state,5,0,"white"); put(state,5,4,"white"); put(state,4,1,"black"); put(state,2,3,"black"); put(state,0,7,"black");
  const halfway = applyMove(state,{ from:{row:5,col:0},to:{row:3,col:2} });
  await openPosition(page,halfway); await page.getByRole("button",{name:"3D counters",exact:true}).click(); await expect(page.locator(".board-3d-status")).toContainText("Tap to move", { timeout: 20000 });
  await tap(page,"e3",8,.013); await tap(page,"f4",8);
  await tap(page,"c5",8,.013); await tap(page,"e7",8);
  await page.getByRole("button",{name:"2D board",exact:true}).click();
  await expect(page.locator("[data-square='e7'] [data-piece='checker-man'][data-owner='white']")).toBeVisible();
  await expect(page.locator("[data-square='e3'] [data-piece='checker-man'][data-owner='white']")).toBeVisible();
  await expect(page.locator("[data-square='d6'] [data-piece]")).toHaveCount(0);
});

test("a failed draughts model and WebGL loss retain a usable 2D position", async ({ page }) => {
  await page.route("**/assets/draughts/collection.glb", route=>route.abort());
  await page.goto("/en/play/international-draughts?mode=offline&time=freestyle");
  await page.getByRole("group",{name:"Side",exact:true}).getByRole("button",{name:"White",exact:true}).click();
  await page.getByRole("button",{name:"Start Game",exact:true}).click();
  await page.getByRole("button",{name:"3D counters",exact:true}).click();
  await page.getByRole("button",{name:"Use 2D board",exact:true}).click();
  await page.locator("[data-square='b4']").click(); await page.locator("[data-square='c5']").click();
  await expect(page.locator("[data-square='c5'] [data-piece='checker-man']")).toBeVisible();
  await page.unroute("**/assets/draughts/collection.glb");
  await page.getByRole("button",{name:"3D counters",exact:true}).click(); await expect(page.locator(".board-3d-status")).toContainText("Tap to move", { timeout: 20000 });
  await page.locator(".board-3d canvas").evaluate(canvas => (canvas as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await page.getByRole("button",{name:"Use 2D board",exact:true}).click();
  await expect(page.locator("[data-square='c5'] [data-piece='checker-man']")).toBeVisible();
});
