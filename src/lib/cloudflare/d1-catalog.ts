import type { D1Database } from "@cloudflare/workers-types";

import { gameFamilies, getCatalogStats, type BoardGeometry, type BotEngineAdapter, type CatalogStats, type GameCatalogEntry, type GameFamilyKey, type PiecePresentationPack, type PlayabilityStatus, type PlayableGameVerification, type RulesEngineAdapter } from "@/lib/catalog";

type CatalogEntryRow = {
  id: string;
  variant_key?: string | null;
  family_key: string;
  english_name: string;
  native_name?: string | null;
  romanization?: string | null;
  aliases?: string | null;
  region?: string | null;
  board_geometry: string;
  piece_presentation: string;
  playability: string;
  rules_adapter: string;
  bot_adapter: string;
  learning_status: "ready" | "draft" | "researching";
  source_links?: string | null;
  rules_complete?: number | null;
  bot_complete?: number | null;
  review_complete?: number | null;
  persistence_complete?: number | null;
  e2e_complete?: number | null;
  known_gaps?: string | null;
  verified_at?: string | null;
};

type RuleSectionRow = {
  game_id: string;
  section_type: "basics" | "special" | "win" | "draw" | "illegal" | "examples" | "review";
  body: string;
};

type RuleSourceRow = {
  game_id: string;
  name: string;
  url: string;
};

type CatalogStatsRow = {
  family_key: string;
  total_games?: number | null;
  playable_games?: number | null;
  learn_games?: number | null;
  coming_soon_games?: number | null;
};

const emptyVerification: PlayableGameVerification = {
  rulesComplete: false,
  botComplete: false,
  reviewComplete: false,
  persistenceComplete: false,
  e2eComplete: false,
  knownGaps: []
};

export async function listD1CatalogEntries(db: D1Database): Promise<GameCatalogEntry[]> {
  const rows = await db
    .prepare(
      `select
        c.id,
        c.variant_key,
        c.family_key,
        c.english_name,
        c.native_name,
        c.romanization,
        c.aliases,
        c.region,
        c.board_geometry,
        c.piece_presentation,
        c.playability,
        c.rules_adapter,
        c.bot_adapter,
        c.learning_status,
        c.source_links,
        v.rules_complete,
        v.bot_complete,
        v.review_complete,
        v.persistence_complete,
        v.e2e_complete,
        v.known_gaps,
        v.verified_at
       from game_catalog_entries c
       left join playable_game_verification v on v.game_id = c.id
       order by c.family_key, c.english_name`
    )
    .all<CatalogEntryRow>();
  const entries = rows.results ?? [];
  if (entries.length === 0) return [];

  const [sections, sources] = await Promise.all([readRuleSections(db), readRuleSources(db)]);
  return entries.map((row) => rowToCatalogEntry(row, sections, sources));
}

export async function getD1CatalogEntry(db: D1Database, idOrAlias: string): Promise<GameCatalogEntry | null> {
  const normalized = normalizeAlias(idOrAlias);
  const alias = await db
    .prepare(
      `select game_id
       from game_aliases
       where normalized_alias = ?
       order by case kind when 'english' then 0 when 'common' then 1 else 2 end
       limit 1`
    )
    .bind(normalized)
    .first<{ game_id?: string }>();
  const targetId = alias?.game_id ?? idOrAlias;
  const entries = await listD1CatalogEntries(db);
  return entries.find((entry) => entry.id === targetId || entry.variantKey === targetId || entry.aliases.includes(targetId)) ?? null;
}

export async function getD1CatalogStats(db: D1Database): Promise<CatalogStats> {
  const rows = await db
    .prepare(
      `select
        family_key,
        count(*) as total_games,
        sum(case when playability = 'playable' then 1 else 0 end) as playable_games,
        sum(case when playability = 'learn' then 1 else 0 end) as learn_games,
        sum(case when playability = 'coming-soon' then 1 else 0 end) as coming_soon_games
       from game_catalog_entries
       group by family_key`
    )
    .bind()
    .all<CatalogStatsRow>();
  const statsRows = rows.results ?? [];
  if (statsRows.length === 0) return getCatalogStats();

  const familyCounts = Object.fromEntries(gameFamilies.map((family) => [family.key, 0])) as CatalogStats["familyCounts"];
  let totalGames = 0;
  let playableGames = 0;
  let learnGames = 0;
  let comingSoonGames = 0;

  for (const row of statsRows) {
    const familyKey = row.family_key as GameFamilyKey;
    const familyTotal = Number(row.total_games ?? 0);
    if (familyKey in familyCounts) {
      familyCounts[familyKey] = familyTotal;
    }
    totalGames += familyTotal;
    playableGames += Number(row.playable_games ?? 0);
    learnGames += Number(row.learn_games ?? 0);
    comingSoonGames += Number(row.coming_soon_games ?? 0);
  }

  return { totalGames, playableGames, learnGames, comingSoonGames, familyCounts };
}

async function readRuleSections(db: D1Database) {
  const rows = await db
    .prepare(
      `select game_id, section_type, body
       from rule_sections
       order by game_id, section_type, sort_order`
    )
    .all<RuleSectionRow>();
  return groupRows(rows.results ?? [], (row) => row.game_id);
}

async function readRuleSources(db: D1Database) {
  const rows = await db
    .prepare(
      `select game_id, name, url
       from rule_sources
       order by game_id, sort_order`
    )
    .all<RuleSourceRow>();
  return groupRows(rows.results ?? [], (row) => row.game_id);
}

function rowToCatalogEntry(row: CatalogEntryRow, sections: Map<string, RuleSectionRow[]>, sources: Map<string, RuleSourceRow[]>): GameCatalogEntry {
  const ruleSections = sections.get(row.id) ?? [];
  const sourceRows = sources.get(row.id) ?? [];
  return {
    id: row.id,
    variantKey: row.variant_key ?? undefined,
    name: {
      english: row.english_name,
      native: row.native_name ?? undefined,
      romanization: row.romanization ?? undefined
    },
    aliases: parseJson<string[]>(row.aliases, []),
    family: row.family_key as GameFamilyKey,
    region: parseJson<string[]>(row.region, []),
    board: parseJson<BoardGeometry>(row.board_geometry, { kind: "square-grid", rows: 8, cols: 8, description: "Board data unavailable." }),
    piecePresentation: row.piece_presentation as PiecePresentationPack,
    playability: row.playability as PlayabilityStatus,
    rulesAdapter: row.rules_adapter as RulesEngineAdapter,
    botAdapter: row.bot_adapter as BotEngineAdapter,
    learningStatus: row.learning_status,
    ruleSourceLinks: sourceRows.length > 0 ? sourceRows.map(({ name, url }) => ({ name, url })) : parseJson<Array<{ name: string; url: string }>>(row.source_links, []),
    shortRules: linesFor(ruleSections, "basics"),
    winConditions: linesFor(ruleSections, "win"),
    reviewFocus: linesFor(ruleSections, "review"),
    recommendations: [],
    verification: verificationFromRow(row)
  };
}

function verificationFromRow(row: CatalogEntryRow): PlayableGameVerification {
  if (row.rules_complete === undefined && row.known_gaps === undefined) return emptyVerification;
  return {
    rulesComplete: Boolean(row.rules_complete),
    botComplete: Boolean(row.bot_complete),
    reviewComplete: Boolean(row.review_complete),
    persistenceComplete: Boolean(row.persistence_complete),
    e2eComplete: Boolean(row.e2e_complete),
    knownGaps: parseJson<string[]>(row.known_gaps, [])
  };
}

function linesFor(sections: RuleSectionRow[], sectionType: RuleSectionRow["section_type"]) {
  const lines: string[] = [];
  for (const section of sections) {
    if (section.section_type !== sectionType) continue;
    for (const rawLine of section.body.split("\n")) {
      const line = rawLine.trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

function groupRows<T>(rows: T[], keyFor: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAlias(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}
