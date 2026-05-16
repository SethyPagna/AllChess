import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const browserClientCandidates = [
  join(homedir(), ".codex", "plugins", "cache", "openai-curated", "vercel", "08373044", "skills", "agent-browser", "scripts", "browser-client.mjs"),
  join(homedir(), ".codex", "plugins", "cache", "openai-curated", "vercel", "08373044", "scripts", "browser-client.mjs")
];

const foundClient = browserClientCandidates.find((candidate) => existsSync(candidate));
const result = {
  browserPlugin: {
    preferred: "in-app-browser-plugin",
    status: foundClient ? "available" : "unavailable",
    missingClient: foundClient ? null : "scripts/browser-client.mjs",
    checkedCandidates: browserClientCandidates,
    fallback: foundClient ? null : "playwright-plus-live-http-smoke"
  },
  activeValidation: foundClient ? ["in-app-browser-plugin", "playwright"] : ["playwright", "live-http-smoke"]
};

console.log(JSON.stringify(result, null, 2));
