import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";

import type { CloudflareEnv } from "./env";

type D1ApiResponse<T = Record<string, unknown>> = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<D1Result<T>> | D1Result<T>;
};

type D1RestConfig = {
  accountId: string;
  databaseId: string;
  apiToken?: string;
  globalApiKey?: string;
  email?: string;
};

export function createD1RestDatabase(env: Pick<CloudflareEnv, "CLOUDFLARE_ACCOUNT_ID" | "CLOUDFLARE_D1_DATABASE_ID" | "CLOUDFLARE_API_TOKEN">) {
  const config = readD1RestConfig(env);
  if (!config) return null;
  return new D1RestDatabase(config) as unknown as D1Database;
}

function readD1RestConfig(env: Pick<CloudflareEnv, "CLOUDFLARE_ACCOUNT_ID" | "CLOUDFLARE_D1_DATABASE_ID" | "CLOUDFLARE_API_TOKEN">): D1RestConfig | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = env.CLOUDFLARE_D1_DATABASE_ID;
  if (!accountId || !databaseId) return null;

  const globalApiKey = process.env.CLOUDFLARE_GLOBAL_API_KEY;
  const email = process.env.CLOUDFLARE_EMAIL;
  return {
    accountId,
    databaseId,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    globalApiKey,
    email
  };
}

class D1RestDatabase {
  constructor(private readonly config: D1RestConfig) {}

  prepare(sql: string) {
    return new D1RestPreparedStatement(this.config, sql) as unknown as D1PreparedStatement;
  }
}

class D1RestPreparedStatement {
  private values: unknown[] = [];

  constructor(
    private readonly config: D1RestConfig,
    private readonly sql: string
  ) {}

  bind(...values: unknown[]) {
    const next = new D1RestPreparedStatement(this.config, this.sql);
    next.values = values;
    return next;
  }

  async run<T = Record<string, unknown>>() {
    return queryD1<T>(this.config, this.sql, this.values);
  }

  async all<T = Record<string, unknown>>() {
    return queryD1<T>(this.config, this.sql, this.values);
  }

  async first<T = Record<string, unknown>>() {
    const result = await queryD1<T>(this.config, this.sql, this.values);
    return (result.results?.[0] ?? null) as T | null;
  }
}

async function queryD1<T>(config: D1RestConfig, sql: string, params: unknown[]): Promise<D1Result<T>> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`, {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      ...authorizationHeaders(config)
    }),
    body: JSON.stringify({ sql, params: params.map(normalizeParam) })
  });

  const json = (await response.json().catch(() => ({}))) as D1ApiResponse<T>;
  const result = Array.isArray(json.result) ? json.result[0] : json.result;
  const querySucceeded = (result as { success?: boolean } | undefined)?.success;
  if (!response.ok || json.success === false || querySucceeded === false) {
    throw new Error(json.errors?.map((error) => error.message).filter(Boolean).join("; ") || `Cloudflare D1 request failed (${response.status})`);
  }
  return (result ?? { success: true, results: [] }) as D1Result<T>;
}

function authorizationHeaders(config: D1RestConfig): Record<string, string> {
  if (config.globalApiKey && config.email) {
    return {
      "X-Auth-Email": config.email,
      "X-Auth-Key": config.globalApiKey
    };
  }
  if (config.apiToken) {
    return { Authorization: `Bearer ${config.apiToken}` };
  }
  return {};
}

function normalizeParam(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}
