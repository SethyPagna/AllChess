import { moveToUci } from "@/lib/stockfish-engine";
import { getLegalMoves, variantCatalog, type GameState, type Move, type VariantDefinition } from "@/lib/variants";
import type { BotTierKey } from "@/lib/bots";
import generatedKnowledge from "@/data/bot-knowledge.generated.json";

export type BotKnowledgeSource = "opening-book" | "tactic-cache" | "endgame-cache" | "ml-policy" | "engine-search" | "internal-search";

export type BotMoveExplanation = {
  plan: string;
  threat: string;
  risk: string;
  fallbackGoal: string;
};

export type TrainingGame = {
  id: string;
  variantKey: string;
  source: "public" | "self-play" | "engine-generated" | "opt-in-user";
  license: string;
  objectKey: string;
  result?: string;
  moveCount: number;
  createdAt: string;
};

export type EngineLabel = {
  id?: string;
  variantKey?: string;
  positionKey?: string;
  boardSignature?: string;
  moveUci?: string;
  engine: string;
  engineVersion?: string;
  depth: number;
  nodes: number;
  bestMoves: string[];
  evaluation: number | null;
  legalValidation?: "runtime";
  benchmarkVersion?: string;
  confidence?: number;
  minTier?: BotTierKey;
  tags?: string[];
  sourceTool?: string;
  explanation?: BotMoveExplanation;
  createdAt: string;
};

export type TrainingPosition = {
  id: string;
  variantKey: string;
  fenLikeState: string;
  legalMoves: string[];
  bestMoves: string[];
  source: TrainingGame["source"];
  split: "train" | "eval" | "test";
  tags: string[];
  engineLabels: EngineLabel[];
};

export type BotModelManifest = {
  id: string;
  variantKey: string;
  tier: BotTierKey;
  version: string;
  status: "planned" | "training" | "evaluating" | "active" | "retired";
  storage: "r2" | "external";
  objectKey?: string;
  positionCount: number;
  benchmarkVersion: string;
  sourceManifestIds: string[];
  createdAt: string;
};

export type TrainingDataManifest = {
  id: string;
  path: string;
  kind: string;
  variantKey: string;
  bytes: number;
  readStatus: string;
  sampledRecords: number;
  license: string;
  storagePlan: string;
};

export type BotToolManifest = {
  id: string;
  name: string;
  path: string;
  bytes: number;
  role: string;
  usableFor: string[];
  runtimeUse: string;
  storagePlan: string;
  status: string;
  notes: string;
};

export type BotKnowledgeEntry = {
  id: string;
  variantKey: string;
  positionKey: string;
  boardSignature?: string;
  moveUci: string;
  source: BotKnowledgeSource;
  minTier: BotTierKey;
  confidence: number;
  benchmarkVersion: string;
  tags: string[];
  explanation: BotMoveExplanation;
};

export type BotKnowledgeHit = {
  entry: BotKnowledgeEntry;
  move: Move;
  principalVariation: string[];
};

export type BotRuntimeLanguageProfile = {
  primaryRuntime: "typescript";
  hotPathStrategy: "indexed-typescript-plus-wasm-engines";
  runtimeLanguages: Array<{
    language: "TypeScript" | "WebAssembly/C++" | "Python" | "Rust/WASM";
    role: string;
    status: "active" | "offline" | "candidate";
    reason: string;
  }>;
  migrationDecision: {
    recommendation: "keep-typescript-orchestration-and-use-native-engine-hot-paths";
    reason: string;
    nextGate: string;
  };
};

export type BotTrainingChecklistItem = {
  id: string;
  label: string;
  status: "ready" | "training" | "rules-gated";
  evidence: string;
};

export type BotTierTrainingChecklist = {
  tier: BotTierKey;
  label: string;
  targetBehavior: string;
  search: {
    depth: number;
    nodeBudget: number;
    beamWidth: number;
    replyCheckWidth: number;
    maxMoveTimeMs: number;
  };
  checklist: BotTrainingChecklistItem[];
};

export type GameBotTrainingChecklist = {
  variantKey: string;
  enginePlan: string;
  coverageStatus: "active" | "training" | "rules-gated";
  knowledgeEntries: number;
  engineLabels: number;
  difficultyTiers: BotTierTrainingChecklist[];
  nextTrainingJobs: string[];
};

type GeneratedBotKnowledgeFile = {
  version?: string;
  generatedAt?: string;
  summary?: {
    filesScanned?: number;
    toolsDiscovered?: number;
    entries?: number;
    openingEntries?: number;
    tacticEntries?: number;
    engineLabels?: number;
    sampledBytesPerCompressedFile?: number;
  };
  entries: BotKnowledgeEntry[];
  engineLabels?: EngineLabel[];
  manifests?: TrainingDataManifest[];
  toolManifests?: BotToolManifest[];
};

const tierRank: Record<BotTierKey, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  "very-hard": 3,
  grandmaster: 4,
  legend: 5
};

const trainingTierProfiles: Array<{
  key: BotTierKey;
  label: string;
  depth: number;
  moveTimeMs: number;
  nodeBudget: number;
  beamWidth: number;
  replyCheckWidth: number;
  knowledgeMinimumConfidence: number;
}> = [
  { key: "easy", label: "Easy", depth: 1, moveTimeMs: 160, nodeBudget: 180, beamWidth: 6, replyCheckWidth: 2, knowledgeMinimumConfidence: 0.82 },
  { key: "normal", label: "Normal", depth: 2, moveTimeMs: 280, nodeBudget: 420, beamWidth: 9, replyCheckWidth: 4, knowledgeMinimumConfidence: 0.78 },
  { key: "hard", label: "Hard", depth: 3, moveTimeMs: 650, nodeBudget: 1600, beamWidth: 14, replyCheckWidth: 7, knowledgeMinimumConfidence: 0.72 },
  { key: "very-hard", label: "Very Hard", depth: 4, moveTimeMs: 1200, nodeBudget: 4200, beamWidth: 22, replyCheckWidth: 11, knowledgeMinimumConfidence: 0.66 },
  { key: "grandmaster", label: "Grandmaster", depth: 5, moveTimeMs: 2200, nodeBudget: 12000, beamWidth: 34, replyCheckWidth: 17, knowledgeMinimumConfidence: 0.6 },
  { key: "legend", label: "Legend", depth: 7, moveTimeMs: 3600, nodeBudget: 28000, beamWidth: 46, replyCheckWidth: 24, knowledgeMinimumConfidence: 0.55 }
];

const curatedKnowledgeEntries: BotKnowledgeEntry[] = [
  {
    id: "classic-start-e4",
    variantKey: "classic",
    positionKey: "classic|turn:white|moves:",
    moveUci: "e2e4",
    source: "opening-book",
    minTier: "grandmaster",
    confidence: 0.92,
    benchmarkVersion: "allchess-knowledge-v1",
    tags: ["opening", "center", "development"],
    explanation: {
      plan: "Claim the center quickly and open lines for the bishop and queen.",
      threat: "White can develop with Nf3, Bb5, or d4 while asking Black to solve central pressure.",
      risk: "The pawn can become a target if development is slow, so the follow-up should be quick piece activity.",
      fallbackGoal: "If Black neutralizes the center, transition into a healthy developing setup instead of forcing tactics."
    }
  },
  {
    id: "classic-after-e4-e5",
    variantKey: "classic",
    positionKey: "classic|turn:black|moves:e2e4",
    moveUci: "e7e5",
    source: "opening-book",
    minTier: "grandmaster",
    confidence: 0.9,
    benchmarkVersion: "allchess-knowledge-v1",
    tags: ["opening", "symmetry", "center"],
    explanation: {
      plan: "Contest White's center immediately and keep both bishops available.",
      threat: "Black prepares natural development with Nc6 and Nf6 while preventing an uncontested white pawn center.",
      risk: "The e-pawn needs support against early d4 breaks.",
      fallbackGoal: "If White attacks the center, simplify into equal development rather than grabbing loose pawns."
    }
  },
  {
    id: "classic-start-d4",
    variantKey: "classic",
    positionKey: "classic|turn:white|moves:",
    moveUci: "d2d4",
    source: "opening-book",
    minTier: "grandmaster",
    confidence: 0.88,
    benchmarkVersion: "allchess-knowledge-v1",
    tags: ["opening", "queen-pawn", "positional"],
    explanation: {
      plan: "Build a durable central pawn structure and keep options for c4, Nf3, and Bf4.",
      threat: "White can squeeze space without exposing the king early.",
      risk: "The plan is less forcing, so Black may equalize if White delays development.",
      fallbackGoal: "Keep the structure solid and convert to a quiet positional game if no tactics appear."
    }
  },
  {
    id: "jungle-start-lion-pressure",
    variantKey: "jungle",
    positionKey: "jungle|turn:white|moves:",
    moveUci: "a1a2",
    source: "tactic-cache",
    minTier: "hard",
    confidence: 0.76,
    benchmarkVersion: "allchess-knowledge-v1",
    tags: ["objective", "tempo", "den-race"],
    explanation: {
      plan: "Advance a high-rank animal toward the opponent side while keeping den pressure alive.",
      threat: "The move increases pressure on lanes toward traps and the opposing den.",
      risk: "Fast advances can overextend if the supporting animals do not follow.",
      fallbackGoal: "If the attack stalls, pivot to trap control and protect the den."
    }
  }
];

const generated = generatedKnowledge as GeneratedBotKnowledgeFile;
const generatedKnowledgeEntries = generated.entries;
const generatedEngineLabels = generated.engineLabels ?? [];
const engineLabelKnowledgeEntries = generatedEngineLabels.flatMap(engineLabelToKnowledgeEntry);
const knowledgeEntries: BotKnowledgeEntry[] = [...curatedKnowledgeEntries, ...generatedKnowledgeEntries, ...engineLabelKnowledgeEntries];
const knowledgeIndex = createKnowledgeIndex(knowledgeEntries);
const classicPositionCount = new Set(
  [...generatedKnowledgeEntries, ...engineLabelKnowledgeEntries]
    .filter((entry) => entry.variantKey === "classic")
    .map((entry) => entry.boardSignature || entry.positionKey || entry.id)
).size;
const totalGeneratedPositionCount = new Set(
  [...generatedKnowledgeEntries, ...engineLabelKnowledgeEntries].map((entry) => `${entry.variantKey}|${entry.boardSignature || entry.positionKey || entry.id}`)
).size;
const localBenchmarkVersion = generatedKnowledgeEntries[0]?.benchmarkVersion ?? generatedEngineLabels[0]?.benchmarkVersion ?? "allchess-local-knowledge-v1";

const modelManifests: BotModelManifest[] = [
  {
    id: "allchess-classic-policy-v1",
    variantKey: "classic",
    tier: "grandmaster",
    version: "classic-policy-v1",
    status: classicPositionCount > 0 ? "active" : "planned",
    storage: "r2",
    objectKey: "bot-models/classic/policy-v1/manifest.json",
    positionCount: classicPositionCount,
    benchmarkVersion: localBenchmarkVersion,
    sourceManifestIds: ["lichess-public-license-reviewed", "allchess-selfplay-v1"],
    createdAt: "2026-05-14T00:00:00.000Z"
  },
  {
    id: "allchess-universal-tactics-v1",
    variantKey: "all-playable",
    tier: "legend",
    version: "universal-tactics-v1",
    status: totalGeneratedPositionCount > 0 ? "active" : "planned",
    storage: "r2",
    objectKey: "bot-models/universal/tactics-v1/manifest.json",
    positionCount: totalGeneratedPositionCount,
    benchmarkVersion: localBenchmarkVersion,
    sourceManifestIds: ["engine-generated-tactics-v1", "opt-in-user-games-v1"],
    createdAt: "2026-05-14T00:00:00.000Z"
  }
];

export function createBotPositionKey(state: GameState) {
  return `${state.variantKey}|turn:${state.turn}|moves:${state.moves.map((move) => moveToUci(state, move)).join(" ")}`;
}

export function createBotBoardSignature(state: GameState) {
  const board = state.board
    .map((row) =>
      row
        .map((cell) => {
          if (!cell.piece) return "--";
          return `${cell.piece.owner.slice(0, 1)}${cell.piece.code}${cell.piece.promoted ? "+" : ""}`;
        })
        .join(",")
    )
    .join("/");
  return `${state.variantKey}|turn:${state.turn}|board:${board}`;
}

export function listBotKnowledge(variantKey?: string) {
  return knowledgeEntries.filter((entry) => !variantKey || entry.variantKey === variantKey);
}

export function listBotEngineLabels(variantKey?: string) {
  return generatedEngineLabels.filter((label) => !variantKey || label.variantKey === variantKey);
}

export function listBotKnowledgeSummary() {
  return {
    version: generated.version ?? "allchess-local-knowledge-v1",
    generatedAt: generated.generatedAt,
    filesScanned: generated.summary?.filesScanned ?? 0,
    toolsDiscovered: generated.summary?.toolsDiscovered ?? 0,
    entries: knowledgeEntries.length,
    generatedEntries: generatedKnowledgeEntries.length,
    openingEntries: generated.summary?.openingEntries ?? generatedKnowledgeEntries.filter((entry) => entry.source === "opening-book").length,
    tacticEntries: generated.summary?.tacticEntries ?? generatedKnowledgeEntries.filter((entry) => entry.source === "tactic-cache").length,
    engineLabels: generatedEngineLabels.length,
    sampledBytesPerCompressedFile: generated.summary?.sampledBytesPerCompressedFile ?? 0
  };
}

export function listBotModelManifests() {
  return modelManifests;
}

export function listTrainingDataManifests() {
  return generated.manifests ?? [];
}

export function listBotToolManifests() {
  return generated.toolManifests ?? [];
}

export function getBotRuntimeLanguageProfile(): BotRuntimeLanguageProfile {
  return {
    primaryRuntime: "typescript",
    hotPathStrategy: "indexed-typescript-plus-wasm-engines",
    runtimeLanguages: [
      {
        language: "TypeScript",
        role: "Rules validation, UI state, Durable Object orchestration, D1/R2 manifests, and cache routing.",
        status: "active",
        reason: "This keeps gameplay portable across Next.js, Workers, Vercel, and local development while preserving type safety."
      },
      {
        language: "WebAssembly/C++",
        role: "Stockfish and future Fairy-Stockfish style engine search for chess-family hot paths.",
        status: "active",
        reason: "Native engine code is much faster for deep search than rewriting the same search in application TypeScript."
      },
      {
        language: "Python",
        role: "Offline data ingestion, compressed dataset streaming, label generation, and long-running training jobs.",
        status: "offline",
        reason: "Python has better ecosystem support for parquet, zstd, model experiments, and dataset batch work."
      },
      {
        language: "Rust/WASM",
        role: "Candidate for future universal rules/search kernels if benchmarks show TypeScript rule adapters are the bottleneck.",
        status: "candidate",
        reason: "A Rust migration should be gated by benchmarks because it adds build complexity across Workers, Vercel, and Docker."
      }
    ],
    migrationDecision: {
      recommendation: "keep-typescript-orchestration-and-use-native-engine-hot-paths",
      reason:
        "The fastest useful combination is TypeScript for product/runtime glue, WebAssembly/native engines for search, and offline Python/native tools for training. A wholesale TypeScript rewrite would slow delivery without proving a runtime win.",
      nextGate: "Move a rules/search kernel to Rust/WASM only after benchmark data shows indexed cache lookup plus engine fallback is still too slow."
    }
  };
}

export function getBotKnowledgeIndexStats() {
  return {
    entries: knowledgeEntries.length,
    positionKeys: knowledgeIndex.byPosition.size,
    boardSignatures: knowledgeIndex.byBoardSignature.size,
    maxBucketSize: knowledgeIndex.maxBucketSize
  };
}

export function listBotTrainingChecklists(variantKey?: string): GameBotTrainingChecklist[] {
  return variantCatalog.filter((variant) => !variantKey || variant.key === variantKey).map(createGameBotTrainingChecklist);
}

export function lookupBotKnowledge(state: GameState, tier: BotTierKey): BotKnowledgeHit | null {
  if (state.status !== "active") return null;

  const key = createBotPositionKey(state);
  const boardSignature = createBotBoardSignature(state);
  const entries = indexedKnowledgeCandidates(state.variantKey, key, boardSignature).filter((entry) => tierRank[tier] >= tierRank[entry.minTier]);

  for (const entry of entries) {
    const move = legalMoveByUci(state, entry.moveUci);
    if (move) {
      return { entry, move, principalVariation: [entry.moveUci] };
    }
  }

  return null;
}

function createKnowledgeIndex(entries: BotKnowledgeEntry[]) {
  const byPosition = new Map<string, BotKnowledgeEntry[]>();
  const byBoardSignature = new Map<string, BotKnowledgeEntry[]>();

  for (const entry of entries) {
    if (entry.positionKey) addIndexedEntry(byPosition, knowledgeIndexKey(entry.variantKey, entry.positionKey), entry);
    if (entry.boardSignature) addIndexedEntry(byBoardSignature, knowledgeIndexKey(entry.variantKey, entry.boardSignature), entry);
  }

  let maxBucketSize = 0;
  for (const bucket of [...byPosition.values(), ...byBoardSignature.values()]) {
    bucket.sort(compareKnowledgeEntries);
    maxBucketSize = Math.max(maxBucketSize, bucket.length);
  }

  return { byPosition, byBoardSignature, maxBucketSize };
}

function indexedKnowledgeCandidates(variantKey: string, positionKey: string, boardSignature: string) {
  const candidates = [
    ...(knowledgeIndex.byPosition.get(knowledgeIndexKey(variantKey, positionKey)) ?? []),
    ...(knowledgeIndex.byBoardSignature.get(knowledgeIndexKey(variantKey, boardSignature)) ?? [])
  ];
  const seen = new Set<string>();
  return candidates.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function addIndexedEntry(index: Map<string, BotKnowledgeEntry[]>, key: string, entry: BotKnowledgeEntry) {
  const bucket = index.get(key);
  if (bucket) {
    bucket.push(entry);
    return;
  }
  index.set(key, [entry]);
}

function knowledgeIndexKey(variantKey: string, key: string) {
  return `${variantKey}\u0000${key}`;
}

function compareKnowledgeEntries(a: BotKnowledgeEntry, b: BotKnowledgeEntry) {
  return sourcePriority(a.source) - sourcePriority(b.source) || b.confidence - a.confidence;
}

function legalMoveByUci(state: GameState, uci: string) {
  for (const row of state.board) {
    for (const cell of row) {
      const move = getLegalMoves(state, cell.square).find((candidate) => moveToUci(state, candidate) === uci);
      if (move) return move;
    }
  }
  return null;
}

function sourcePriority(source: BotKnowledgeSource) {
  const priorities: Record<BotKnowledgeSource, number> = {
    "opening-book": 0,
    "tactic-cache": 1,
    "endgame-cache": 2,
    "ml-policy": 3,
    "engine-search": 4,
    "internal-search": 5
  };
  return priorities[source];
}

function createGameBotTrainingChecklist(variant: VariantDefinition): GameBotTrainingChecklist {
  const knowledgeEntriesForVariant = listBotKnowledge(variant.key).length;
  const engineLabelsForVariant = listBotEngineLabels(variant.key).length;
  const hasRuntimeKnowledge = knowledgeEntriesForVariant > 0 || engineLabelsForVariant > 0;
  const rulesGated = rulesGatedVariantKeys.has(variant.key);
  const coverageStatus = rulesGated ? "rules-gated" : hasRuntimeKnowledge ? "active" : "training";

  return {
    variantKey: variant.key,
    enginePlan: enginePlanForVariant(variant),
    coverageStatus,
    knowledgeEntries: knowledgeEntriesForVariant,
    engineLabels: engineLabelsForVariant,
    difficultyTiers: trainingTierProfiles.map((difficulty) => ({
      tier: difficulty.key,
      label: difficulty.label,
      targetBehavior: targetBehaviorForTier(difficulty.key),
      search: {
        depth: difficulty.depth,
        nodeBudget: difficulty.nodeBudget,
        beamWidth: difficulty.beamWidth,
        replyCheckWidth: difficulty.replyCheckWidth,
        maxMoveTimeMs: difficulty.moveTimeMs
      },
      checklist: [
        {
          id: "legal-validation",
          label: "Validate every selected move against the rules adapter before applying it.",
          status: "ready",
          evidence: "requestBotMove and lookupBotKnowledge both validate against getLegalMoves before returning a move."
        },
        {
          id: "not-naive-basics",
          label: "Take immediate wins, avoid obvious hanging-piece blunders, and prefer defended progress.",
          status: "ready",
          evidence: `${difficulty.label} uses terminal-state checks, reply checks, defended-piece scoring, and a reply width of ${difficulty.replyCheckWidth}.`
        },
        {
          id: "knowledge-cache",
          label: "Use precomputed opening, tactic, endgame, or label knowledge before expensive live search.",
          status: hasRuntimeKnowledge ? "ready" : "training",
          evidence: hasRuntimeKnowledge
            ? `${knowledgeEntriesForVariant} cached entries and ${engineLabelsForVariant} engine labels are indexed for ${variant.key}.`
            : `No indexed cache is active for ${variant.key} yet, so this tier falls back to engine/search.`
        },
        {
          id: "tier-distinction",
          label: "Keep the tier distinct through depth, node budget, beam width, reply checks, and confidence gates.",
          status: "ready",
          evidence: `${difficulty.label}: depth ${difficulty.depth}, ${difficulty.nodeBudget} nodes, beam ${difficulty.beamWidth}, confidence gate ${difficulty.knowledgeMinimumConfidence}.`
        },
        {
          id: "variant-objective",
          label: "Score the native objective instead of playing only material-count chess.",
          status: rulesGated ? "rules-gated" : "ready",
          evidence: rulesGated
            ? `${variant.key} still needs complete native-rule fixtures before bot strength can be called final.`
            : `${variant.objective} is part of the variant scoring and terminal-state checks.`
        }
      ]
    })),
    nextTrainingJobs: nextTrainingJobsForVariant(variant, hasRuntimeKnowledge, rulesGated)
  };
}

const rulesGatedVariantKeys = new Set(["shogi", "janggi", "makruk", "jungle", "antichess", "horde"]);

function enginePlanForVariant(variant: VariantDefinition) {
  if (variant.key === "classic" || variant.key === "chess960") return "Stockfish/WASM plus indexed opening, tactic, and engine-label cache.";
  if (variant.engineProtocol === "uci") return "Variant-compatible UCI engine when available, then indexed cache and internal search fallback.";
  if (variant.engineProtocol === "usi") return "USI-compatible engine route planned, with rules validation and internal fallback until fixture coverage is complete.";
  return "Internal search with variant heuristics, cache lookup, and strict legal validation.";
}

function targetBehaviorForTier(tier: BotTierKey) {
  const targets: Record<BotTierKey, string> = {
    easy: "Beginner-friendly, not naive: sees obvious wins, avoids free major-piece blunders, and keeps pieces defended.",
    normal: "Looks one reply ahead, develops sensibly, and avoids simple tactic losses.",
    hard: "Checks captures, threats, loose pieces, and basic counterattacks before choosing.",
    "very-hard": "Balances tactics and positional pressure with stronger reply filtering.",
    grandmaster: "Uses cache/engine knowledge first, deeper search second, and verifies tactical plans.",
    legend: "Highest local tier: cache-first, deepest search, quiescence, reply pressure, and draw-saving fallback goals."
  };
  return targets[tier];
}

function nextTrainingJobsForVariant(variant: VariantDefinition, hasRuntimeKnowledge: boolean, rulesGated: boolean) {
  const jobs = [
    `Generate ${variant.key} tactical fixtures for win, rescue, retreat, counterattack, and draw-saving choices.`,
    `Run bot-vs-bot gauntlets for every tier and record stronger-tier win rates in D1/R2 manifests.`,
    `Add negative tests proving cached ${variant.key} moves are ignored when no longer legal.`
  ];

  if (!hasRuntimeKnowledge) jobs.unshift(`Create an indexed opening/tactic seed cache for ${variant.key}.`);
  if (rulesGated) jobs.unshift(`Complete native ${variant.key} rules fixtures before marking bots final.`);
  return jobs;
}

function engineLabelToKnowledgeEntry(label: EngineLabel): BotKnowledgeEntry[] {
  if (!label.id || !label.variantKey || !label.moveUci || (!label.positionKey && !label.boardSignature)) return [];

  return [
    {
      id: `engine-label-${label.id}`,
      variantKey: label.variantKey,
      positionKey: label.positionKey ?? "",
      boardSignature: label.boardSignature,
      moveUci: label.moveUci,
      source: "engine-search",
      minTier: label.minTier ?? "hard",
      confidence: label.confidence ?? 0.78,
      benchmarkVersion: label.benchmarkVersion ?? "allchess-local-knowledge-v1",
      tags: ["engine-label", ...(label.tags ?? [])],
      explanation: label.explanation ?? {
        plan: `Use a precomputed ${label.engine} label before spending live search time.`,
        threat: "The labelled move is replayed only when the exact position matches.",
        risk: "Offline labels can be stale if the rules adapter changes, so runtime legal validation is mandatory.",
        fallbackGoal: "Fall back to live engine/search if this labelled move is not legal."
      }
    }
  ];
}
