import { writeFileSync } from "node:fs";

const DEFAULT_SOURCE = process.env.CATALOG_SOURCE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const DEFAULT_DATABASE = "allchess";
const DEFAULT_CONFIG = "wrangler.jsonc";
const RULES_VERSION = "catalog-v1";

export function normalizeAlias(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}

export function buildCatalogNormalizationSql(entries, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const statements = [
    "delete from playable_game_verification;",
    "delete from rule_sections;",
    "delete from rule_sources;",
    "delete from game_regions;",
    "delete from game_aliases;",
    "delete from rules_versions;",
    "delete from game_catalog_entries;"
  ];
  const counts = {
    entries: 0,
    aliases: 0,
    regions: 0,
    ruleSources: 0,
    ruleSections: 0,
    verificationRows: 0
  };

  for (const entry of entries) {
    counts.entries += 1;
    const rulesVersionId = `${entry.id}:${RULES_VERSION}`;
    const sourceLinks = entry.ruleSourceLinks ?? [];
    statements.push(
      `insert into game_catalog_entries (${[
        "id",
        "variant_key",
        "family_key",
        "english_name",
        "native_name",
        "romanization",
        "aliases",
        "region",
        "board_geometry",
        "piece_presentation",
        "playability",
        "rules_adapter",
        "bot_adapter",
        "learning_status",
        "source_links",
        "rules_version",
        "updated_at"
      ].join(", ")}) values (${[
        sql(entry.id),
        sql(entry.variantKey ?? null),
        sql(entry.family),
        sql(entry.name?.english ?? entry.id),
        sql(entry.name?.native ?? null),
        sql(entry.name?.romanization ?? null),
        json(entry.aliases ?? []),
        json(entry.region ?? []),
        json(entry.board ?? {}),
        sql(entry.piecePresentation),
        sql(entry.playability),
        sql(entry.rulesAdapter),
        sql(entry.botAdapter),
        sql(entry.learningStatus),
        json(sourceLinks),
        sql(RULES_VERSION),
        sql(now)
      ].join(", ")});`
    );
    statements.push(
      `insert into rules_versions (id, game_id, version, source_links, numbered_basics, special_rules, win_conditions, draw_conditions, illegal_move_notes, status, created_at) values (${[
        sql(rulesVersionId),
        sql(entry.id),
        sql(RULES_VERSION),
        json(sourceLinks),
        json(entry.shortRules ?? []),
        json([]),
        json(entry.winConditions ?? []),
        json([]),
        json([]),
        sql("active"),
        sql(now)
      ].join(", ")});`
    );

    for (const alias of aliasRows(entry)) {
      counts.aliases += 1;
      statements.push(
        `insert or ignore into game_aliases (game_id, alias, normalized_alias, locale, kind, created_at) values (${[
          sql(entry.id),
          sql(alias.value),
          sql(normalizeAlias(alias.value)),
          sql(alias.locale),
          sql(alias.kind),
          sql(now)
        ].join(", ")});`
      );
    }

    for (const region of entry.region ?? []) {
      counts.regions += 1;
      statements.push(
        `insert or ignore into game_regions (game_id, region_code, region_name, created_at) values (${[
          sql(entry.id),
          sql(normalizeAlias(region) || "global"),
          sql(region),
          sql(now)
        ].join(", ")});`
      );
    }

    sourceLinks.forEach((source, index) => {
      counts.ruleSources += 1;
      statements.push(
        `insert or replace into rule_sources (id, game_id, name, url, publisher, accessed_at, sort_order, created_at) values (${[
          sql(`${entry.id}:source:${index + 1}`),
          sql(entry.id),
          sql(source.name),
          sql(source.url),
          sql(source.publisher ?? null),
          sql(source.accessedAt ?? null),
          String(index),
          sql(now)
        ].join(", ")});`
      );
    });

    for (const section of sectionRows(entry, rulesVersionId)) {
      counts.ruleSections += 1;
      statements.push(
        `insert or replace into rule_sections (id, game_id, rules_version_id, section_type, sort_order, title, body, examples, created_at) values (${[
          sql(section.id),
          sql(entry.id),
          sql(rulesVersionId),
          sql(section.type),
          String(section.order),
          sql(section.title),
          sql(section.body),
          json(section.examples),
          sql(now)
        ].join(", ")});`
      );
    }

    counts.verificationRows += 1;
    const verification = verificationFor(entry);
    statements.push(
      `insert or replace into playable_game_verification (game_id, rules_complete, bot_complete, review_complete, persistence_complete, e2e_complete, known_gaps, verified_at, updated_at) values (${[
        sql(entry.id),
        bit(verification.rulesComplete),
        bit(verification.botComplete),
        bit(verification.reviewComplete),
        bit(verification.persistenceComplete),
        bit(verification.e2eComplete),
        json(verification.knownGaps),
        sql(verification.verifiedAt),
        sql(now)
      ].join(", ")});`
    );
  }

  return { sql: `${statements.join("\n")}\n`, counts };
}

export async function fetchCatalogEntries(sourceUrl = DEFAULT_SOURCE) {
  const url = new URL("/api/catalog", sourceUrl);
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Catalog fetch failed for ${url.toString()}. Start the app or pass --source <url>. Cause: ${cause}`);
  }
  if (!response.ok) throw new Error(`Catalog fetch failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  if (!Array.isArray(payload.entries)) throw new Error("Catalog payload did not include an entries array.");
  return payload.entries;
}

function aliasRows(entry) {
  const rows = [
    { value: entry.id, kind: "common", locale: "und" },
    { value: entry.name?.english, kind: "english", locale: "en" },
    { value: entry.name?.native, kind: "native", locale: "und" },
    { value: entry.name?.romanization, kind: "romanization", locale: "und" },
    { value: entry.name?.short, kind: "common", locale: "und" },
    ...(entry.aliases ?? []).map((value) => ({ value, kind: "common", locale: "und" }))
  ].filter((row) => row.value);
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.kind}:${row.locale}:${row.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sectionRows(entry, rulesVersionId) {
  return [
    {
      id: `${entry.id}:basics`,
      type: "basics",
      order: 0,
      title: "Basics",
      body: (entry.shortRules ?? []).join("\n"),
      examples: []
    },
    {
      id: `${entry.id}:win`,
      type: "win",
      order: 1,
      title: "How it ends",
      body: (entry.winConditions ?? []).join("\n"),
      examples: []
    },
    {
      id: `${entry.id}:review`,
      type: "review",
      order: 2,
      title: "Review focus",
      body: (entry.reviewFocus ?? []).join("\n"),
      examples: []
    }
  ].filter((section) => section.body.length > 0 && rulesVersionId);
}

function verificationFor(entry) {
  const verification = entry.verification;
  const ready = entry.playability === "playable";
  const allComplete =
    verification?.rulesComplete ??
    (ready && Boolean(entry.variantKey));
  return {
    rulesComplete: allComplete,
    botComplete: verification?.botComplete ?? ready,
    reviewComplete: verification?.reviewComplete ?? ready,
    persistenceComplete: verification?.persistenceComplete ?? ready,
    e2eComplete: verification?.e2eComplete ?? ready,
    knownGaps: verification?.knownGaps ?? (ready ? [] : ["Not verified playable yet."]),
    verifiedAt: ready ? new Date(0).toISOString() : null
  };
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function json(value) {
  return sql(JSON.stringify(value));
}

function bit(value) {
  return value ? "1" : "0";
}

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    database: DEFAULT_DATABASE,
    config: DEFAULT_CONFIG,
    target: "print",
    out: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") args.source = argv[++index];
    else if (arg === "--database") args.database = argv[++index];
    else if (arg === "--config") args.config = argv[++index];
    else if (arg === "--remote") args.target = "remote";
    else if (arg === "--local") args.target = "local";
    else if (arg === "--print") args.target = "print";
    else if (arg === "--out") args.out = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = await fetchCatalogEntries(args.source);
  const { sql: generatedSql, counts } = buildCatalogNormalizationSql(entries);
  console.error(
    `Catalog normalization rows: ${counts.entries} entries, ${counts.aliases} aliases, ${counts.ruleSections} rule sections, ${counts.verificationRows} verification gates.`
  );

  if (args.out) {
    writeFileSync(args.out, generatedSql, "utf8");
    return;
  }

  if (args.target === "print") {
    process.stdout.write(generatedSql);
    return;
  }

  throw new Error("Use --print or --out with this Node generator. Use scripts/data/sync-catalog-d1.ps1 for local or remote Wrangler execution on Windows.");
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("sync-catalog-d1.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
