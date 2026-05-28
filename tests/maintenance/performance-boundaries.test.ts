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
});
