import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();

describe("performance boundaries", () => {
  test("game board lazy-loads heavyweight bot runtime", () => {
    const boardSource = readFileSync(join(repoRoot, "src", "components", "board", "game-board.tsx"), "utf8");
    const configSource = readFileSync(join(repoRoot, "src", "lib", "bot", "config.ts"), "utf8");

    expect(boardSource).not.toMatch(/import\s+\{[^}]*requestBotMove[^}]*}\s+from\s+["']@\/lib\/bot\/runtime["']/);
    expect(boardSource).toContain('await import("@/lib/bot/runtime")');
    expect(configSource).not.toContain("@/lib/bot/training");
    expect(configSource).not.toContain("bot-knowledge.generated.json");
  });

  test("board grid renders cells without flatMap allocation", () => {
    const boardGridSource = readFileSync(join(repoRoot, "src", "components", "board", "board-grid.tsx"), "utf8");

    expect(boardGridSource).not.toContain(".flatMap");
  });

  test("compact bot knowledge stays within Cloudflare asset limits", () => {
    const generatedPath = join(repoRoot, "src", "data", "bot-knowledge.generated.json");
    const size = statSync(generatedPath).size;

    expect(size).toBeLessThan(16 * 1024 * 1024);
  });

  test("bot runtime avoids nested flatMap allocation in legal move generation", () => {
    const botRuntimeSource = readFileSync(join(repoRoot, "src", "lib", "bot", "runtime.ts"), "utf8");

    expect(botRuntimeSource).not.toMatch(/flatMap\(\(row\).*getLegalMoves/s);
  });

  test("bot runtime builds search cache keys without nested board maps", () => {
    const botRuntimeSource = readFileSync(join(repoRoot, "src", "lib", "bot", "runtime.ts"), "utf8");

    expect(botRuntimeSource).not.toMatch(/function searchStateKey[\s\S]*?state\.board\s*\n\s*\.map/);
  });

  test("variant draw checks scan pieces without flattening the board", () => {
    const variantEngineSource = readFileSync(join(repoRoot, "src", "lib", "variants", "engine.ts"), "utf8");

    expect(variantEngineSource).not.toContain("state.board.flatMap");
  });

  test("variant engine move generators avoid flatMap allocation", () => {
    const variantEngineSource = readFileSync(join(repoRoot, "src", "lib", "variants", "engine.ts"), "utf8");

    expect(variantEngineSource).not.toContain(".flatMap");
  });

  test("board scoring and piece counts avoid nested reducer allocation", () => {
    const botRuntimeSource = readFileSync(join(repoRoot, "src", "lib", "bot", "runtime.ts"), "utf8");
    const variantEngineSource = readFileSync(join(repoRoot, "src", "lib", "variants", "engine.ts"), "utf8");

    expect(botRuntimeSource).not.toContain("state.board.reduce");
    expect(variantEngineSource).not.toMatch(/state\.board\.reduce[\s\S]*?row\.filter/);
  });

  test("bot passed-pawn scoring scans blockers without nested board some allocation", () => {
    const botRuntimeSource = readFileSync(join(repoRoot, "src", "lib", "bot", "runtime.ts"), "utf8");

    expect(botRuntimeSource).not.toMatch(/function passedPawnScore[\s\S]*?state\.board\.some/);
  });

  test("variant attack and legal-move checks scan the board without nested some allocation", () => {
    const variantEngineSource = readFileSync(join(repoRoot, "src", "lib", "variants", "engine.ts"), "utf8");

    expect(variantEngineSource).not.toMatch(/function isSquareAttacked[\s\S]*?state\.board\.some/);
    expect(variantEngineSource).not.toMatch(/function hasAnyLegalMove[\s\S]*?state\.board\.some/);
    expect(variantEngineSource).not.toMatch(/function hasAnyCaptureMove[\s\S]*?state\.board\.some/);
  });
});
