import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([".git", ".next", ".open-next", ".vercel", ".wrangler", "node_modules"]);
const ignoredRootDirectories = new Set([".next", ".open-next", ".vercel", ".wrangler", "coverage", "playwright-report", "public", "test-results"]);
const ignoredFilePrefixes = ["public/engines/"];
const allowedJavaScriptFiles = new Set(["next.config.mjs"]);
const allowedRootFiles = new Set([
  ".gitignore",
  ".vercelignore",
  "next-env.d.ts",
  "next.config.mjs",
  "open-next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.ts",
  "tsconfig.json",
  "vercel.json"
]);
const allowedRootDirectories = new Set([".git", "data", "node_modules", "ops", "src"]);

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
  test("keeps root files limited to package and root-discovered tool files", () => {
    const rootFiles = readdirSync(repoRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !name.endsWith(".tsbuildinfo"))
      .sort();

    expect(rootFiles).toEqual([...allowedRootFiles].sort());
  });

  test("keeps root directories limited to source, ops, and local dependency folders", () => {
    const unexpectedRootDirectories = readdirSync(repoRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !ignoredRootDirectories.has(name))
      .filter((name) => !allowedRootDirectories.has(name))
      .sort();

    expect(unexpectedRootDirectories).toEqual([]);
  });

  test("keeps root TypeScript config as a small discovery shim", () => {
    const tsconfig = JSON.parse(readFileSync(join(repoRoot, "tsconfig.json"), "utf8")) as {
      extends?: string;
      compilerOptions?: Record<string, unknown>;
      include?: string[];
      exclude?: string[];
    };

    expect(tsconfig.extends).toBe("./ops/config/typescript/tsconfig.app.json");
    expect(tsconfig.compilerOptions).toEqual({
      baseUrl: ".",
      ignoreDeprecations: "6.0",
      paths: {
        "@/*": ["src/*"]
      }
    });
    expect(tsconfig.include).toBeUndefined();
    expect(tsconfig.exclude).toBeUndefined();
  });

  test("keeps first-party source and config in TypeScript instead of JavaScript", () => {
    const javaScriptFiles = walkFiles(repoRoot)
      .map(toRepoPath)
      .filter((file) => !ignoredFilePrefixes.some((prefix) => file.startsWith(prefix)))
      .filter((file) => !allowedJavaScriptFiles.has(file))
      .filter((file) => /\.(?:mjs|cjs|js|jsx)$/.test(file));

    expect(javaScriptFiles).toEqual([]);
  });

  test("does not keep the obsolete legacy reference archive in the application tree", () => {
    expect(existsSync(join(repoRoot, "archive"))).toBe(false);
  });

  test("keeps global styles in the styles folder instead of the app router folder", () => {
    expect(existsSync(join(repoRoot, "src", "styles", "globals.css"))).toBe(true);
    expect(existsSync(join(repoRoot, "src", "app", "globals.css"))).toBe(false);
  });

  test("keeps local project scripts in TypeScript entry points", () => {
    const scriptFiles = walkFiles(join(repoRoot, "ops", "scripts")).map(toRepoPath);
    const javaScriptScripts = scriptFiles.filter((file) => /\.(?:mjs|cjs|js|jsx)$/.test(file));

    expect(javaScriptScripts).toEqual([]);
  });

  test("groups operational scripts under ops/scripts/ops", () => {
    const topLevelScriptDirectories = readdirSync(join(repoRoot, "ops", "scripts"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(topLevelScriptDirectories).toEqual(["assets", "data", "ops", "training"]);
    expect(existsSync(join(repoRoot, "ops", "scripts", "ops", "audit"))).toBe(true);
    expect(existsSync(join(repoRoot, "ops", "scripts", "ops", "deploy"))).toBe(true);
    expect(existsSync(join(repoRoot, "ops", "scripts", "ops", "maintenance"))).toBe(true);
  });

  test("runs package script helpers through TypeScript entry points", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    const localScriptCommands = Object.values(packageJson.scripts).filter((command) => command.includes("ops/scripts/"));

    expect(localScriptCommands).not.toEqual([]);
    for (const command of localScriptCommands) {
      expect(command).not.toMatch(/ops\/scripts\/[^\s]+\.mjs/);
      expect(command).not.toMatch(/ops\/scripts\/[^\s]+\.js/);
    }
  });

  test("does not keep unused variant engine packages as direct dependencies", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies).not.toHaveProperty("@kaisukez/makruk-js");
    expect(packageJson.dependencies).not.toHaveProperty("chessops");
    expect(packageJson.dependencies).not.toHaveProperty("shogiops");
    expect(packageJson.dependencies).not.toHaveProperty("xiangqiops");
  });

  test("keeps Vercel CLI out of the local dependency graph", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.dependencies).not.toHaveProperty("vercel");
    expect(packageJson.devDependencies).not.toHaveProperty("vercel");
    expect(packageJson.scripts["deploy:preview"]).toContain("npx --yes vercel@latest");
    expect(packageJson.scripts["deploy:prod"]).toContain("npx --yes vercel@latest");
  });

  test("keeps infrastructure files grouped under ops/infra", () => {
    expect(existsSync(join(repoRoot, "ops", "infra", "docker", "Dockerfile"))).toBe(true);
    expect(existsSync(join(repoRoot, "ops", "infra", "cloudflare", "d1", "migrations"))).toBe(true);
  });

  test("keeps test files grouped by concern instead of flat at the ops/tests root", () => {
    const topLevelTestFiles = readdirSync(join(repoRoot, "ops", "tests"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(name));

    expect(topLevelTestFiles).toEqual([]);
  });

  test("keeps shared library code grouped by domain folders", () => {
    const topLevelLibFiles = readdirSync(join(repoRoot, "src", "lib"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    expect(topLevelLibFiles).toEqual([]);
  });
});
