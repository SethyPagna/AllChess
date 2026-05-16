import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();

describe("performance boundaries", () => {
  test("game board lazy-loads heavyweight bot runtime", () => {
    const boardSource = readFileSync(join(repoRoot, "src", "components", "game-board.tsx"), "utf8");
    const configSource = readFileSync(join(repoRoot, "src", "lib", "bot-config.ts"), "utf8");

    expect(boardSource).not.toMatch(/import\s+\{[^}]*requestBotMove[^}]*}\s+from\s+["']@\/lib\/bots["']/);
    expect(boardSource).toContain('await import("@/lib/bots")');
    expect(configSource).not.toContain("@/lib/bot-training");
    expect(configSource).not.toContain("bot-knowledge.generated.json");
  });

  test("compact bot knowledge stays within Cloudflare asset limits", () => {
    const generatedPath = join(repoRoot, "src", "data", "bot-knowledge.generated.json");
    const size = statSync(generatedPath).size;

    expect(size).toBeLessThan(16 * 1024 * 1024);
  });
});
