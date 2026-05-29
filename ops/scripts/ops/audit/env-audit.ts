import { auditEnv, type EnvAuditTarget, formatEnvAudit } from "../../../../src/lib/validation/env-audit.ts";

const allowedTargets = new Set<EnvAuditTarget>(["local", "vercel", "cloudflare", "docker"]);
const target = process.argv[2] || process.env.DEPLOYMENT_TARGET || "local";

if (!allowedTargets.has(target as EnvAuditTarget)) {
  console.error(`Usage: npm run audit:env -- <local|vercel|cloudflare|docker>`);
  process.exit(2);
}

const result = auditEnv(target as EnvAuditTarget, process.env);
process.stdout.write(formatEnvAudit(result));
if (!result.ok) process.exit(1);
