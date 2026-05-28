import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const markdownRoots = ["docs"];
const stalePatterns = [
  /(?<!config\/env\/)\.env\.example/,
  /(?<!infra\/cloudflare\/)wrangler\.jsonc/,
  /(?<!infra\/)cloudflare\/d1\/migrations/,
  /(?<!next\.config)\.mjs\b/,
  /scripts\/<domain>/,
  /src\/lib\/bots\.ts/,
  /src\/lib\/bot-training\.ts/,
  /src\/lib\/game-review\.ts/,
  /src\/lib\/game-outcome\.ts/,
  /src\/lib\/stockfish-engine\.ts/,
  /archive\/reference\/python-jungle-chess/
];

function walkMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return walkMarkdownFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

function toRepoPath(path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

describe("markdown documentation", () => {
  test("does not reference stale moved files or JavaScript script extensions", () => {
    const staleReferences = markdownRoots
      .flatMap((root) => walkMarkdownFiles(join(repoRoot, root)))
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        return stalePatterns
          .filter((pattern) => pattern.test(text))
          .map((pattern) => `${toRepoPath(file)} matched ${pattern}`);
      });

    expect(staleReferences).toEqual([]);
  });

  test("documents current package stack versions in README", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const readme = readFileSync(join(repoRoot, "docs", "README.md"), "utf8");

    const expectedVersions = {
      "Next.js": packageJson.dependencies.next,
      React: packageJson.dependencies.react,
      TypeScript: packageJson.devDependencies.typescript,
      Vitest: packageJson.devDependencies.vitest,
      Playwright: packageJson.devDependencies["@playwright/test"],
      Wrangler: packageJson.devDependencies.wrangler,
      "OpenNext Cloudflare": packageJson.devDependencies["@opennextjs/cloudflare"]
    };

    for (const [name, version] of Object.entries(expectedVersions)) {
      expect(readme).toContain(`- ${name}: \`${version}\``);
    }
  });
});
