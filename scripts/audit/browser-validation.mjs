import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const pluginCacheRoot = join(homedir(), ".codex", "plugins", "cache");
const browserClientCandidates = await findBrowserClientCandidates(pluginCacheRoot);

const foundClient = browserClientCandidates.find((candidate) => existsSync(candidate));
const result = {
  browserPlugin: {
    preferred: "in-app-browser-plugin",
    status: foundClient ? "available" : "unavailable",
    missingClient: foundClient ? null : "scripts/browser-client.mjs",
    checkedRoot: pluginCacheRoot,
    checkedCandidates: browserClientCandidates.slice(0, 20),
    fallback: foundClient ? null : "playwright-plus-live-http-smoke"
  },
  activeValidation: foundClient ? ["in-app-browser-plugin", "playwright"] : ["playwright", "live-http-smoke"]
};

console.log(JSON.stringify(result, null, 2));

async function findBrowserClientCandidates(root) {
  const directCandidates = [
    join(root, "openai-bundled", "browser", "0.1.0-alpha2", "scripts", "browser-client.mjs"),
    join(root, "openai-bundled", "browser", "0.1.0-alpha2", "skills", "browser", "scripts", "browser-client.mjs")
  ];

  if (!existsSync(root)) {
    return directCandidates;
  }

  const discovered = [];
  await collectBrowserClients(root, discovered, 0);
  return [...new Set([...discovered, ...directCandidates])];
}

async function collectBrowserClients(directory, output, depth) {
  if (depth > 7 || output.length >= 50) return;

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const childPath = join(directory, entry.name);

    if (entry.isFile() && entry.name === "browser-client.mjs") {
      output.push(childPath);
      continue;
    }

    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    await collectBrowserClients(childPath, output, depth + 1);
  }
}
