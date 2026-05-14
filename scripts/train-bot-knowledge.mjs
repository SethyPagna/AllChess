import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const defaultDataRoot = join(repoRoot, "CHESS DATA");
const defaultOutput = join(repoRoot, "src", "data", "bot-knowledge.generated.json");

const options = parseArgs(process.argv.slice(2));
const dataRoot = options.dataRoot ?? defaultDataRoot;
const outputPath = options.output ?? defaultOutput;
const maxGames = Number(options.maxGames ?? 250);
const maxPuzzles = Number(options.maxPuzzles ?? 300);
const maxBytes = Number(options.maxBytes ?? 20_000_000);
const maxOpeningPly = Number(options.maxOpeningPly ?? 10);

if (!existsSync(dataRoot)) {
  throw new Error(`Data root not found: ${dataRoot}`);
}

const files = scanFiles(dataRoot);
const manifests = files.map((file) => describeFile(dataRoot, file));
const toolManifests = files.map((file) => describeTool(dataRoot, file)).filter(Boolean);
const openingBook = new Map();
const entries = [];
let puzzleCount = 0;

for (const file of files) {
  const manifest = manifests.find((item) => item.path === normalizePath(relative(dataRoot, file)));
  if (!manifest) continue;

  if (isPgnFile(file) && manifest.variantKey === "classic") {
    const sample = readTextSample(file, maxBytes);
    manifest.readStatus = sample.status;
    if (sample.text) {
      const games = parsePgnGames(sample.text).slice(0, maxGames);
      for (const game of games) {
        addOpeningGame(openingBook, game, maxOpeningPly);
      }
      manifest.sampledRecords = games.length;
    }
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

entries.unshift(...compileOpeningEntries(openingBook));

const output = {
  version: `allchess-local-knowledge-${new Date().toISOString().slice(0, 10)}`,
  generatedAt: new Date().toISOString(),
  sourceRoot: "CHESS DATA",
  summary: {
    filesScanned: manifests.length,
    toolsDiscovered: toolManifests.length,
    entries: entries.length,
    openingEntries: entries.filter((entry) => entry.source === "opening-book").length,
    tacticEntries: entries.filter((entry) => entry.source === "tactic-cache").length,
    sampledBytesPerCompressedFile: maxBytes
  },
  entries,
  manifests,
  toolManifests
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${entries.length} knowledge entries to ${relative(repoRoot, outputPath)}`);
console.log(`Scanned ${manifests.length} files from ${relative(repoRoot, dataRoot)}`);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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

function scanFiles(root) {
  const found = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) found.push(fullPath);
    }
  }
  return found.sort();
}

function describeFile(root, file) {
  const stats = statSync(file);
  const path = normalizePath(relative(root, file));
  return {
    id: stableId(path),
    path,
    kind: detectKind(file),
    variantKey: detectVariantKey(path),
    bytes: stats.size,
    readStatus: "not-sampled",
    sampledRecords: 0,
    license: licenseFor(path),
    storagePlan: path.endsWith(".zip") || path.endsWith(".zst") || path.endsWith(".parquet") ? "r2-raw-artifact" : "r2-normalized-artifact"
  };
}

function describeTool(root, file) {
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

function toolProfile(name) {
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

function detectKind(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith(".pgn") || lower.endsWith(".pgn.zst")) return "pgn";
  if (lower.endsWith(".csv") || lower.endsWith(".csv.zst")) return "csv";
  if (lower.endsWith(".parquet") || lower.endsWith(".parquet.crdownload")) return "parquet";
  if (lower.endsWith(".zip")) return "zip-tool";
  return extname(lower).replace(".", "") || "unknown";
}

function detectVariantKey(path) {
  const parts = path.toLowerCase().split(/[\\/]/);
  if (parts.includes("antichess")) return "antichess";
  if (parts.includes("atomic")) return "atomic";
  if (parts.includes("chess960")) return "chess960";
  if (parts.includes("crazyhouse")) return "crazyhouse";
  if (parts.includes("chess")) return "classic";
  if (path.toLowerCase().includes("puzzle")) return "classic";
  return "unknown";
}

function licenseFor(path) {
  const lower = path.toLowerCase();
  if (lower.includes("lichess") || lower.includes("puzzle")) return "public Lichess data; verify downstream license before publishing derived models";
  if (lower.includes("aix-lichess-database")) return "cc0-1.0";
  return "local-unverified";
}

function isPgnFile(file) {
  const lower = file.toLowerCase();
  return lower.endsWith(".pgn") || lower.endsWith(".pgn.zst");
}

function isCsvFile(file) {
  const lower = file.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".csv.zst");
}

function readTextSample(file, limitBytes) {
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

function readZstdTextSample(file, limitBytes) {
  const python = spawnSync("python", ["-c", "import zstandard"], { encoding: "utf8" });
  if (python.status !== 0) {
    return { status: "skipped: install Python package zstandard to stream .zst samples", text: "" };
  }

  const code = `
import io, sys, zstandard
path = sys.argv[1]
limit = int(sys.argv[2])
written = 0
dctx = zstandard.ZstdDecompressor()
with open(path, "rb") as source:
    with dctx.stream_reader(source) as reader:
        text = io.TextIOWrapper(reader, encoding="utf-8", errors="ignore")
        while written < limit:
            chunk = text.read(min(65536, limit - written))
            if not chunk:
                break
            sys.stdout.write(chunk)
            written += len(chunk.encode("utf-8", errors="ignore"))
`;

  const result = spawnSync("python", ["-c", code, file, String(limitBytes)], {
    encoding: "utf8",
    maxBuffer: limitBytes + 1_000_000
  });

  if (result.status !== 0) {
    const error = result.stderr.trim() || `python exited ${result.status}`;
    return { status: `zst-read-failed: ${error}`, text: "" };
  }

  return { status: "sampled-zst", text: result.stdout };
}

function parsePgnGames(text) {
  return text
    .split(/\n(?=\[Event\s+")/g)
    .map((game) => game.trim())
    .filter(Boolean);
}

function addOpeningGame(book, pgn, maxPly) {
  const chess = new Chess();
  const tokens = extractMoveTokens(pgn);
  const played = [];
  for (const token of tokens.slice(0, maxPly)) {
    const beforeKey = `classic|turn:${chess.turn() === "w" ? "white" : "black"}|moves:${played.join(" ")}`;
    const move = chess.move(token);
    if (!move) break;
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    const countKey = `${beforeKey}|move:${uci}`;
    book.set(countKey, (book.get(countKey) ?? 0) + 1);
    played.push(uci);
  }
}

function extractMoveTokens(pgn) {
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

function compileOpeningEntries(book) {
  const byPosition = new Map();
  for (const [key, count] of book.entries()) {
    const [positionKey, moveUci] = key.split("|move:");
    const moves = byPosition.get(positionKey) ?? [];
    moves.push({ moveUci, count });
    byPosition.set(positionKey, moves);
  }

  const entries = [];
  for (const [positionKey, moves] of byPosition.entries()) {
    const total = moves.reduce((sum, move) => sum + move.count, 0);
    const best = moves.sort((a, b) => b.count - a.count)[0];
    if (!best || total < 2) continue;
    entries.push({
      id: `local-opening-${stableId(`${positionKey}|${best.moveUci}`)}`,
      variantKey: "classic",
      positionKey,
      moveUci: best.moveUci,
      source: "opening-book",
      minTier: "hard",
      confidence: Number((best.count / total).toFixed(3)),
      benchmarkVersion: "allchess-local-knowledge-v1",
      tags: ["local-data", "opening", `samples:${total}`],
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

function compilePuzzleEntries(csvText, limit) {
  const rows = csvText.split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const header = splitCsvLine(rows[0]);
  const fenIndex = header.indexOf("FEN");
  const movesIndex = header.indexOf("Moves");
  const ratingIndex = header.indexOf("Rating");
  const themesIndex = header.indexOf("Themes");
  if (fenIndex < 0 || movesIndex < 0) return [];

  const entries = [];
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

function splitCsvLine(line) {
  const result = [];
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

function fenToClassicBoardSignature(fen) {
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

function stableId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function normalizePath(path) {
  return path.split(sep).join("/");
}
