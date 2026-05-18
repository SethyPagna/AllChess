import { auditEnv, formatEnvAudit } from "../../src/lib/env-audit.ts";

const allowedTargets = new Set(["local", "vercel", "cloudflare", "docker"]);
const target = process.argv[2] || process.env.DEPLOYMENT_TARGET || "local";

if (!allowedTargets.has(target)) {
  console.error(`Usage: npm run audit:env -- <local|vercel|cloudflare|docker>`);
  process.exit(2);
}

const result = auditEnv(target, process.env);
process.stdout.write(formatEnvAudit(result));
if (!result.ok) process.exit(1);
