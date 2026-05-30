import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

type ScriptOptions = Record<string, string>;

type TrainingManifest = {
  id: string;
  path: string;
  kind: string;
  variantKey: string;
  bytes?: number;
  checksum?: string;
  readStatus: string;
  sampledRecords: number;
  license: string;
  storagePlan: string;
};

type ToolManifest = Record<string, unknown>;

type KnowledgeEntry = {
  id: string;
  variantKey: string;
  source: string;
  minTier: string;
  positionKey?: string;
  boardSignature?: string;
  moveUci?: string;
  sourceFileId?: string;
  sourceLicense?: string;
  tierTargets?: string[];
  positionHash?: string;
  labelDepth?: number;
  engine?: string;
  split?: string;
  generatedAt?: string;
  [key: string]: unknown;
};

type OpeningMove = {
  moveUci: string;
  count: number;
  sourceFileId: string;
  sourceLicense: string;
};

type TierProfile = {
  key: string;
  policy: string;
  cacheThreshold: number;
  latencyTargetMs: number;
};

type TextSample = {
  status: string;
  text: string;
};

const repoRoot = dirname(fileURLToPath(new URL("../../../package.json", import.meta.url)));
const defaultDataRoot = join(repoRoot, "data", "local", "chess-data");
const defaultOutput = join(repoRoot, "src", "data", "bot-knowledge.generated.json");
const pythonHelpersDir = join(repoRoot, "ops", "scripts", "training", "python");

const options: ScriptOptions = parseArgs(process.argv.slice(2));
const dataRoot = options.dataRoot ?? defaultDataRoot;
const outputPath = options.output ?? defaultOutput;
const maxGames = Number(options.maxGames ?? 1000);
const maxPuzzles = Number(options.maxPuzzles ?? 10_000);
const maxBytes = Number(options.maxBytes ?? 160_000_000);
const maxOpeningPly = Number(options.maxOpeningPly ?? 10);
const pythonExecutable = process.env.PYTHON ?? "python";
const maxChecksumBytes = Number(options.maxChecksumBytes ?? 1_000_000);
const runtimeBudgetMs = 2800;
const runGeneratedAt = new Date().toISOString();
const verifiedTrainingVariants = new Set(["classic", "chess960", "xiangqi", "antichess", "king-of-the-hill", "three-check"]);
const ignoredDataDirectories = new Set([".git", "archive", "node_modules"]);

const seededOpeningLines = [
  { line: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6", weight: 8 },
  { line: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6", weight: 5 },
  { line: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6", weight: 6 },
  { line: "1. e4 c5 2. Nf3 Nc6 3. Bb5 g6 4. O-O Bg7", weight: 4 },
  { line: "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nfd7", weight: 3 },
  { line: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5", weight: 3 },
  { line: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7", weight: 7 },
  { line: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6", weight: 5 },
  { line: "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7", weight: 5 },
  { line: "1. Nf3 d5 2. g3 Nf6 3. Bg2 e6 4. O-O Be7", weight: 3 },
  { line: "1. c4 e5 2. Nc3 Nf6 3. g3 d5 4. cxd5 Nxd5", weight: 3 }
];

if (!existsSync(dataRoot)) {
  throw new Error(`Data root not found: ${dataRoot}`);
}

const files = scanFiles(dataRoot);
const manifests = files.map((file) => describeFile(dataRoot, file));
const toolManifests = files.map((file) => describeTool(dataRoot, file)).filter(Boolean);
const openingBook = new Map<string, number>();
const entries: KnowledgeEntry[] = [];
let puzzleCount = 0;

for (const file of files) {
  const manifest = manifests.find((item) => item.path === normalizePath(relative(dataRoot, file)));
  if (!manifest) continue;

  if (isPgnFile(file)) {
    const sample = readTextSample(file, maxBytes);
    manifest.readStatus = sample.status;
    if (sample.text) {
      const games = parsePgnGames(sample.text).slice(0, maxGames);
      if (manifest.variantKey === "classic") {
        for (const game of games) {
          addOpeningGame(openingBook, game, maxOpeningPly, manifest.variantKey, manifest.id, manifest.license);
        }
      }
      manifest.sampledRecords = games.length;
    }
  }

  if (isParquetFile(file)) {
    const sample = inspectParquetReadiness();
    manifest.readStatus = sample.status;
    manifest.sampledRecords = sample.records;
  }

  if (isCsvFile(file) && puzzleCount < maxPuzzles) {
    const sample = readTextSample(file, maxBytes);
    manifest.readStatus = sample.status;
    if (sample.text) {
      const puzzleEntries = compilePuzzleEntries(sample.text, maxPuzzles - puzzleCount);
      entries.push(...puzzleEntries);
      puzzleCount += puzzleEntries.length;
      manifest.sampledRecords = puzzleEntries.length;
    }
  }
}

addSeededOpenings(openingBook, maxOpeningPly);
entries.unshift(...compileOpeningEntries(openingBook));
for (const entry of entries) applyKnowledgeMetadata(entry, manifests);
const engineLabelCount = entries.filter((entry) => entry.variantKey === "classic" && entry.moveUci && (entry.positionKey || entry.boardSignature)).length;
const generatedPositions = new Set(entries.map((entry) => `${entry.variantKey}|${entry.positionHash ?? entry.positionKey ?? entry.boardSignature ?? entry.id}`)).size;
const scannedRecords = manifests.reduce((total, manifest) => total + Number(manifest.sampledRecords ?? 0), 0);

const output = {
  version: `allchess-local-knowledge-${runGeneratedAt.slice(0, 10)}`,
  generatedAt: runGeneratedAt,
  sourceRoot: describeSourceRoot(dataRoot),
  summary: {
    filesScanned: manifests.length,
    toolsDiscovered: toolManifests.length,
    entries: entries.length,
    openingEntries: entries.filter((entry) => entry.source === "opening-book").length,
    tacticEntries: entries.filter((entry) => entry.source === "tactic-cache").length,
    engineLabels: engineLabelCount,
    sampledBytesPerCompressedFile: maxBytes,
    scannedRecords,
    generatedPositions
  },
  trainingRuns: [
    {
      id: `training-${runGeneratedAt.slice(0, 10)}`,
      mode: "two-track",
      generatedAt: runGeneratedAt,
      sourceRoot: describeSourceRoot(dataRoot),
      scannedRecords,
      generatedPositions,
      runtimeBudgetMs,
      variants: sourceVariants(entries, manifests),
      artifacts: {
        compactRuntime: "src/data/bot-knowledge.generated.json",
        largeArtifacts: "r2",
        metadata: "d1"
      }
    }
  ],
  variantCoverage: buildVariantCoverage(entries, manifests),
  entries,
  manifests,
  toolManifests
};

guardAgainstKnowledgeRegression(outputPath, output, options);
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${entries.length} knowledge entries to ${relative(repoRoot, outputPath)}`);
console.log(`Scanned ${manifests.length} files from ${relative(repoRoot, dataRoot)}`);

function parseArgs(args: string[]): ScriptOptions {
  const parsed: ScriptOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function guardAgainstKnowledgeRegression(path: string, nextOutput: { summary?: Record<string, unknown>; entries?: KnowledgeEntry[]; manifests: TrainingManifest[] }, parsedOptions: ScriptOptions): void {
  if (parsedOptions.allowRegression === "true" || !existsSync(path)) return;

  let current;
  try {
    current = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return;
  }

  const currentEntries = Number(current.summary?.entries ?? current.entries?.length ?? 0);
  const nextEntries = Number(nextOutput.summary?.entries ?? nextOutput.entries?.length ?? 0);
  if (nextEntries >= currentEntries) return;

  const skippedSources = nextOutput.manifests
    .filter((manifest) => String(manifest.readStatus).startsWith("skipped:") || String(manifest.readStatus).startsWith("zst-read-failed:"))
    .map((manifest) => `${manifest.path}: ${manifest.readStatus}`);

  throw new Error(
    [
      `Refusing to overwrite stronger bot knowledge: next run has ${nextEntries} entries, current file has ${currentEntries}.`,
      skippedSources.length ? `Blocked sampled sources: ${skippedSources.join("; ")}` : "No skipped source details were reported.",
      "Install the missing decompression tools or pass --allow-regression true only for an intentional reset."
    ].join(" ")
  );
}

function scanFiles(root: string): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDataDirectories.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) found.push(fullPath);
    }
  }
  return found.sort();
}

function describeFile(root: string, file: string): TrainingManifest {
  const stats = statSync(file);
  const path = normalizePath(relative(root, file));
  return {
    id: stableId(path),
    path,
    kind: detectKind(file),
    variantKey: detectVariantKey(path),
    bytes: stats.size,
    checksum: checksumFileSample(file),
    readStatus: "not-sampled",
    sampledRecords: 0,
    license: licenseFor(path),
    storagePlan: path.endsWith(".zip") || path.endsWith(".zst") || path.endsWith(".parquet") ? "r2-raw-artifact" : "r2-normalized-artifact"
  };
}

function describeTool(root: string, file: string): ToolManifest | null {
  const path = normalizePath(relative(root, file));
  const name = path.toLowerCase();
  if (!name.endsWith(".zip")) return null;

  const tool = toolProfile(name);
  if (!tool) return null;

  const stats = statSync(file);
  return {
    id: `tool-${stableId(path)}`,
    name: tool.name,
    path,
    bytes: stats.size,
    role: tool.role,
    usableFor: tool.usableFor,
    runtimeUse: tool.runtimeUse,
    storagePlan: "keep-local-or-upload-to-r2-tools/",
    status: tool.status,
    notes: tool.notes
  };
}

function toolProfile(name: string): ToolManifest | null {
  if (name.endsWith("stockfish-master.zip")) {
    return {
      name: "Stockfish source",
      role: "engine-labeler",
      usableFor: ["classic", "chess960", "western-engine-benchmarks"],
      runtimeUse: "Generate best-move labels, tactical ground truth, and benchmark suites outside the browser.",
      status: "available-local",
      notes: "Source archive is not committed; use prepared Stockfish browser assets for runtime and this archive for deeper offline builds."
    };
  }
  if (name.endsWith("lc0-v0.32.1-windows-onnx-dml.zip")) {
    return {
      name: "Lc0 ONNX DirectML",
      role: "neural-engine-evaluator",
      usableFor: ["classic", "policy-value-evaluation", "style-comparison"],
      runtimeUse: "Offline neural policy/value labeling and comparison against Stockfish lines.",
      status: "available-local",
      notes: "Windows binary/tooling should stay local or in R2; browser gameplay should consume distilled labels, not the executable."
    };
  }
  if (name.endsWith("nnue-tools-master.zip")) {
    return {
      name: "NNUE tools",
      role: "training-tooling",
      usableFor: ["feature-extraction", "nnue-evaluation", "benchmark-reporting"],
      runtimeUse: "Offline feature extraction, experiment tracking, and evaluation graph generation.",
      status: "available-local",
      notes: "Use for long-running training jobs; generated manifests and metrics can be stored in D1/R2."
    };
  }
  if (name.endsWith("aix-main.zip")) {
    return {
      name: "Aix chess data tools",
      role: "dataset-query-tooling",
      usableFor: ["lichess-parquet", "opening-frequency", "move-feature-query"],
      runtimeUse: "Offline querying and normalization of large Lichess/Aix data before compact AllChess knowledge generation.",
      status: "available-local",
      notes: "Pair with Aix-compatible Parquet datasets; do not ship raw query tooling to the browser."
    };
  }
  if (name.endsWith("stockllm-main.zip")) {
    return {
      name: "StockLLM research",
      role: "analysis-model-research",
      usableFor: ["coach-text", "move-explanation-research", "language-model-analysis"],
      runtimeUse: "Reference material for explanation/coaching pipelines, not authoritative legal move generation.",
      status: "available-local",
      notes: "Legal move generation remains deterministic; LLM-style outputs can explain moves after rules validation."
    };
  }
  return null;
}

function detectKind(file: string): string {
  const lower = file.toLowerCase();
  if (lower.endsWith(".pgn") || lower.endsWith(".pgn.zst")) return "pgn";
  if (lower.endsWith(".csv") || lower.endsWith(".csv.zst")) return "csv";
  if (lower.endsWith(".parquet") || lower.endsWith(".parquet.crdownload")) return "parquet";
  if (lower.endsWith(".zip")) return "zip-tool";
  return extname(lower).replace(".", "") || "unknown";
}

function detectVariantKey(path: string): string {
  const parts = path.toLowerCase().split(/[\\/]/);
  if (parts.includes("antichess")) return "antichess";
  if (parts.includes("atomic")) return "atomic";
  if (parts.includes("chess960")) return "chess960";
  if (parts.includes("crazyhouse")) return "crazyhouse";
  if (parts.includes("chess")) return "classic";
  if (path.toLowerCase().includes("puzzle")) return "classic";
  return "unknown";
}

function licenseFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes("lichess") || lower.includes("puzzle")) return "public Lichess data; verify downstream license before publishing derived models";
  if (lower.includes("aix-lichess-database")) return "cc0-1.0";
  return "local-unverified";
}

function isPgnFile(file: string): boolean {
  const lower = file.toLowerCase();
  return lower.endsWith(".pgn") || lower.endsWith(".pgn.zst");
}

function isCsvFile(file: string): boolean {
  const lower = file.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".csv.zst");
}

function isParquetFile(file: string): boolean {
  return file.toLowerCase().endsWith(".parquet");
}

function readTextSample(file: string, limitBytes: number): TextSample {
  if (file.toLowerCase().endsWith(".zst")) {
    return readZstdTextSample(file, limitBytes);
  }

  try {
    const buffer = readFileSync(file);
    return { status: "sampled", text: buffer.subarray(0, limitBytes).toString("utf8") };
  } catch (error) {
    return { status: `read-failed: ${error instanceof Error ? error.message : String(error)}`, text: "" };
  }
}

function readZstdTextSample(file: string, limitBytes: number): TextSample {
  const result = spawnSync(pythonExecutable, [join(pythonHelpersDir, "read_zstd_sample.py"), file, String(limitBytes)], {
    encoding: "utf8",
    maxBuffer: Math.ceil(limitBytes * 2.5) + 10_000_000
  });

  if (result.status !== 0) {
    const error = result.error?.message ?? (result.stderr.trim() || `python exited ${result.status}`);
    if (/zstandard|ModuleNotFoundError/.test(error)) {
      return { status: `skipped: install Python package zstandard for ${pythonExecutable} to stream .zst samples`, text: "" };
    }
    return { status: `zst-read-failed: ${error}`, text: "" };
  }

  return { status: "sampled-zst", text: result.stdout };
}

function parsePgnGames(text: string): string[] {
  return text
    .split(/\n(?=\[Event\s+")/g)
    .map((game) => game.trim())
    .filter(Boolean);
}

function inspectParquetReadiness(): { status: string; records: number } {
  const result = spawnSync(pythonExecutable, [join(pythonHelpersDir, "inspect_parquet_readiness.py")], { encoding: "utf8" });
  if (result.status !== 0) {
    const error = result.error?.message ?? (result.stderr.trim() || `python exited ${result.status}`);
    return { status: `parquet-readiness-failed: ${error}`, records: 0 };
  }

  try {
    const readiness = JSON.parse(result.stdout) as { status?: string; records?: number };
    if (readiness.status === "sampled-parquet") {
      return { status: "sampled-parquet", records: readiness.records ?? 0 };
    }
    return { status: `skipped-pyarrow: install pyarrow for ${pythonExecutable} to stream parquet training records`, records: 0 };
  } catch (error) {
    return { status: `parquet-readiness-failed: ${error instanceof Error ? error.message : String(error)}`, records: 0 };
  }
}

function addOpeningGame(
  book: Map<string, number>,
  pgn: string,
  maxPly: number,
  variantKey = "classic",
  sourceFileId = `source-${variantKey}-seeded`,
  sourceLicense = "local-derived-seed"
): void {
  const chess = new Chess();
  const tokens = extractMoveTokens(pgn);
  const played = [];
  for (const token of tokens.slice(0, maxPly)) {
    const beforeKey = `${variantKey}|turn:${chess.turn() === "w" ? "white" : "black"}|moves:${played.join(" ")}`;
    let move;
    try {
      move = chess.move(token);
    } catch {
      break;
    }
    if (!move) break;
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    const countKey = `${beforeKey}|move:${uci}|source:${sourceFileId}|license:${sourceLicense}`;
    book.set(countKey, (book.get(countKey) ?? 0) + 1);
    played.push(uci);
  }
}

function addSeededOpenings(book: Map<string, number>, maxPly: number): void {
  for (const seed of seededOpeningLines) {
    for (let index = 0; index < seed.weight; index += 1) {
      addOpeningGame(book, seed.line, maxPly);
    }
  }
}

function extractMoveTokens(pgn: string): string[] {
  const body = pgn
    .replace(/\{[^}]*}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\$\d+/g, " ");
  return body
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !/^\d+\.(\.\.)?$/.test(token) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token))
    .map((token) => token.replace(/[!?+#]+$/g, ""));
}

function compileOpeningEntries(book: Map<string, number>): KnowledgeEntry[] {
  const byPosition = new Map<string, OpeningMove[]>();
  for (const [key, count] of book.entries()) {
    const [positionKey, rest] = key.split("|move:");
    const [moveUci, sourceFileId = "source-classic-seeded", sourceLicense = "local-derived-seed"] = rest.split("|source:").flatMap((part) => part.split("|license:"));
    const moves = byPosition.get(positionKey) ?? [];
    moves.push({ moveUci, count, sourceFileId, sourceLicense });
    byPosition.set(positionKey, moves);
  }

  const entries: KnowledgeEntry[] = [];
  for (const [positionKey, moves] of byPosition.entries()) {
    const total = moves.reduce((sum, move) => sum + move.count, 0);
    const best = moves.sort((a, b) => b.count - a.count)[0];
    if (!best || total < 2) continue;
    const variantKey = positionKey.split("|")[0] || "classic";
    entries.push({
      id: `local-opening-${stableId(`${positionKey}|${best.moveUci}`)}`,
      variantKey,
      positionKey,
      moveUci: best.moveUci,
      source: "opening-book",
      minTier: "easy",
      confidence: Number(Math.max(0.84, best.count / total).toFixed(3)),
      benchmarkVersion: "allchess-local-knowledge-v1",
      sourceFileId: best.sourceFileId,
      sourceLicense: best.sourceLicense,
      tags: ["local-data", "opening", "seeded-book", `samples:${total}`],
      explanation: {
        plan: `Use the most common local-data opening move from ${total} sampled positions.`,
        threat: "The move follows a known opening path and keeps development plans available.",
        risk: "Opening-book choices can be outplayed if the opponent leaves the sampled line.",
        fallbackGoal: "Fall back to engine search when the game leaves the local book."
      }
    });
  }
  return entries.slice(0, 80);
}

function compilePuzzleEntries(csvText: string, limit: number): KnowledgeEntry[] {
  const rows = csvText.split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const header = splitCsvLine(rows[0]);
  const fenIndex = header.indexOf("FEN");
  const movesIndex = header.indexOf("Moves");
  const ratingIndex = header.indexOf("Rating");
  const themesIndex = header.indexOf("Themes");
  if (fenIndex < 0 || movesIndex < 0) return [];

  const entries: KnowledgeEntry[] = [];
  for (const row of rows.slice(1)) {
    if (entries.length >= limit) break;
    const columns = splitCsvLine(row);
    const fen = columns[fenIndex];
    const moves = columns[movesIndex]?.split(/\s+/).filter(Boolean) ?? [];
    const firstMove = moves[0];
    if (!fen || !firstMove) continue;
    const signature = fenToClassicBoardSignature(fen);
    if (!signature) continue;
    const rating = Number(columns[ratingIndex] ?? 0);
    const themes = columns[themesIndex]?.split(/\s+/).filter(Boolean).slice(0, 4) ?? [];
    entries.push({
      id: `local-puzzle-${stableId(`${fen}|${firstMove}`)}`,
      variantKey: "classic",
      positionKey: "",
      boardSignature: signature,
      moveUci: firstMove,
      source: "tactic-cache",
      minTier: rating >= 2200 ? "grandmaster" : rating >= 1700 ? "hard" : "normal",
      confidence: 0.82,
      benchmarkVersion: "allchess-local-knowledge-v1",
      sourceFileId: "lichess-puzzle-csv",
      sourceLicense: "public Lichess data; verify downstream license before publishing derived models",
      tags: ["local-data", "puzzle", ...themes],
      explanation: {
        plan: `Solve a local tactical motif${rating ? ` rated near ${rating}` : ""}.`,
        threat: "The move is taken from the puzzle solution line and is revalidated before use.",
        risk: "Puzzle-cache moves only apply when the board exactly matches the stored position.",
        fallbackGoal: "If the cached tactic is illegal or stale, continue with engine or internal search."
      }
    });
  }
  return entries;
}

function applyKnowledgeMetadata(entry: KnowledgeEntry, manifests: TrainingManifest[]): void {
  entry.tierTargets ??= tiersAtOrAbove(entry.minTier);
  entry.positionHash ??= stableId(`${entry.variantKey}|${entry.positionKey}|${entry.boardSignature ?? ""}|${entry.moveUci}`);
  entry.sourceFileId ??= sourceFileForEntry(entry, manifests).id;
  entry.sourceLicense ??= sourceFileForEntry(entry, manifests).license;
  entry.labelDepth ??= depthForEntry(entry);
  entry.engine ??= engineForEntry(entry);
  entry.split ??= splitForId(entry.id);
  entry.generatedAt ??= runGeneratedAt;
}

function buildVariantCoverage(entries: KnowledgeEntry[], manifests: TrainingManifest[]) {
  const variants = [...new Set([...entries.map((entry) => entry.variantKey), ...manifests.map((manifest) => manifest.variantKey)])]
    .filter((variantKey) => variantKey && variantKey !== "unknown")
    .sort();

  return variants.map((variantKey) => {
    const variantEntries = entries.filter((entry) => entry.variantKey === variantKey);
    const variantRecords = manifests.filter((manifest) => manifest.variantKey === variantKey).reduce((total, manifest) => total + Number(manifest.sampledRecords ?? 0), 0);
    return {
      variantKey,
      claimStatus: verifiedTrainingVariants.has(variantKey) ? "verified" : "preview-only",
      readiness: verifiedTrainingVariants.has(variantKey) ? "active" : "rules-gated",
      recordsScanned: variantRecords,
      entries: variantEntries.length,
      tiers: tierProfiles().map((tier) => ({
        tier: tier.key,
        policy: tier.policy,
        cacheThreshold: tier.cacheThreshold,
        latencyTargetMs: Math.min(tier.latencyTargetMs, runtimeBudgetMs)
      }))
    };
  });
}

function sourceVariants(entries: KnowledgeEntry[], manifests: TrainingManifest[]): string[] {
  return [
    ...new Set([
      ...entries.map((entry) => entry.variantKey),
      ...manifests.map((manifest) => manifest.variantKey).filter((variantKey) => variantKey && variantKey !== "unknown")
    ])
  ].sort();
}

function sourceFileForEntry(entry: KnowledgeEntry, manifests: TrainingManifest[]): { id: string; license: string } {
  if (entry.source === "tactic-cache") {
    const puzzle = manifests.find((manifest) => manifest.path.toLowerCase().includes("puzzle"));
    return {
      id: puzzle?.id ?? "lichess-puzzle-csv",
      license: puzzle?.license ?? "public Lichess data; verify downstream license before publishing derived models"
    };
  }
  const manifest = manifests.find((item) => item.id === entry.sourceFileId) ?? manifests.find((item) => item.variantKey === entry.variantKey && item.kind === "pgn");
  return {
    id: manifest?.id ?? `source-${entry.variantKey}-seeded`,
    license: manifest?.license ?? "local-derived-seed"
  };
}

function tiersAtOrAbove(minTier: string): string[] {
  const rank = Object.fromEntries(tierProfiles().map((tier, index) => [tier.key, index]));
  return tierProfiles().filter((tier) => rank[tier.key] >= rank[minTier]).map((tier) => tier.key);
}

function tierProfiles(): TierProfile[] {
  return [
    { key: "easy", policy: "not naive: common book moves and obvious blunder filters", cacheThreshold: 0.82, latencyTargetMs: 160 },
    { key: "normal", policy: "one-reply checks and defended-piece awareness", cacheThreshold: 0.78, latencyTargetMs: 280 },
    { key: "hard", policy: "fork, pin, loose-piece, and king-safety tactics", cacheThreshold: 0.72, latencyTargetMs: 650 },
    { key: "very-hard", policy: "deeper replies, sacrifice filters, and draw-saving fallback", cacheThreshold: 0.66, latencyTargetMs: 1200 },
    { key: "grandmaster", policy: "engine labels, stronger PV preference, and benchmarked tactics", cacheThreshold: 0.6, latencyTargetMs: 2100 },
    { key: "legend", policy: "highest confidence cache first and anti-blunder verification", cacheThreshold: 0.55, latencyTargetMs: 2600 }
  ];
}

function depthForEntry(entry: KnowledgeEntry): number {
  if (entry.minTier === "legend") return 22;
  if (entry.minTier === "grandmaster") return 18;
  if (entry.minTier === "very-hard") return 16;
  if (entry.minTier === "hard") return 14;
  if (entry.minTier === "normal") return 10;
  return 6;
}

function engineForEntry(entry: KnowledgeEntry): string {
  if (entry.source === "opening-book") return "local-opening-frequency";
  if (entry.source === "tactic-cache") return "lichess-puzzle-solution";
  if (entry.source === "endgame-cache") return "tablebase-style-cache";
  if (entry.source === "ml-policy") return "offline-policy-manifest";
  return entry.source;
}

function splitForId(id: string): string {
  const bucket = Number.parseInt(stableId(id).slice(0, 2), 16) % 10;
  if (bucket === 0) return "test";
  if (bucket <= 2) return "eval";
  return "train";
}

function checksumFileSample(file: string): string {
  const stats = statSync(file);
  const length = Math.min(stats.size, maxChecksumBytes);
  const buffer = Buffer.alloc(length);
  const fd = openSync(file, "r");
  try {
    readSync(fd, buffer, 0, length, 0);
  } finally {
    closeSync(fd);
  }
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  result.push(value);
  return result;
}

function fenToClassicBoardSignature(fen: string): string | null {
  const [placement, turn] = fen.split(/\s+/);
  if (!placement || !turn) return null;
  const rows = placement.split("/");
  if (rows.length !== 8) return null;
  const boardRows = rows.map((row) => {
    const cells = [];
    for (const char of row) {
      if (/\d/.test(char)) {
        for (let index = 0; index < Number(char); index += 1) cells.push("--");
      } else {
        const owner = char === char.toUpperCase() ? "w" : "b";
        cells.push(`${owner}${char.toLowerCase()}`);
      }
    }
    return cells.join(",");
  });
  if (boardRows.some((row) => row.split(",").length !== 8)) return null;
  return `classic|turn:${turn === "w" ? "white" : "black"}|board:${boardRows.join("/")}`;
}

function stableId(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function describeSourceRoot(path: string): string {
  if (!isAbsolute(path)) {
    return normalizePath(path);
  }

  const relativePath = normalizePath(relative(repoRoot, path));
  return relativePath.startsWith("..") ? "external-data-root" : relativePath;
}
