import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([".git", ".next", ".open-next", ".vercel", ".wrangler", "node_modules"]);
const ignoredFilePrefixes = ["public/engines/"];

function walkFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...walkFiles(join(directory, entry.name)));
      }
      continue;
    }

    files.push(join(directory, entry.name));
  }

  return files;
}

function toRepoPath(path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

describe("project organization", () => {
  test("keeps first-party source and config in TypeScript instead of JavaScript", () => {
    const javaScriptFiles = walkFiles(repoRoot)
      .map(toRepoPath)
      .filter((file) => !ignoredFilePrefixes.some((prefix) => file.startsWith(prefix)))
      .filter((file) => /\.(?:mjs|cjs|js|jsx)$/.test(file));

    expect(javaScriptFiles).toEqual([]);
  });

  test("keeps local project scripts in TypeScript entry points", () => {
    const scriptFiles = walkFiles(join(repoRoot, "scripts")).map(toRepoPath);
    const javaScriptScripts = scriptFiles.filter((file) => /\.(?:mjs|cjs|js|jsx)$/.test(file));

    expect(javaScriptScripts).toEqual([]);
  });

  test("runs package script helpers through TypeScript entry points", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    const localScriptCommands = Object.values(packageJson.scripts).filter((command) => command.includes("scripts/"));

    expect(localScriptCommands).not.toEqual([]);
    for (const command of localScriptCommands) {
      expect(command).not.toMatch(/scripts\/[^\s]+\.mjs/);
      expect(command).not.toMatch(/scripts\/[^\s]+\.js/);
    }
  });

  test("keeps infrastructure files grouped under infra", () => {
    expect(existsSync(join(repoRoot, "infra", "docker", "Dockerfile"))).toBe(true);
    expect(existsSync(join(repoRoot, "infra", "cloudflare", "d1", "migrations"))).toBe(true);
  });
});
