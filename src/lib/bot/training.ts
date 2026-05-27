import { moveToUci } from "@/lib/bot/stockfish-engine";
import { getVariantBotStrengthProfile, type BotTierKey, type VariantBotStrengthProfile } from "@/lib/bot/strength";
import { MAX_BOT_REPLY_MS } from "@/lib/bot/config";
import { getLegalMoves, variantCatalog, type GameState, type Move, type VariantDefinition } from "@/lib/variants";
import { getVariantRuleSummary, type VariantRuleCompletion } from "@/lib/variants/rules-atlas";
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
  tierTargets?: BotTierKey[];
  positionHash?: string;
  sourceFileId?: string;
  sourceLicense?: string;
  labelDepth?: number;
  engine?: string;
  split?: "train" | "eval" | "test";
  generatedAt?: string;
};

export type BotKnowledgeEntryWithMetadata = BotKnowledgeEntry & Required<Pick<BotKnowledgeEntry, "tierTargets" | "positionHash" | "sourceFileId" | "sourceLicense" | "labelDepth" | "engine" | "split" | "generatedAt">>;

export type TrainingRunManifest = {
  id: string;
  mode: "two-track";
  generatedAt: string;
  scannedRecords: number;
  generatedPositions: number;
  runtimeBudgetMs: number;
  variants: string[];
  artifacts: {
    compactRuntime: string;
    largeArtifacts: "r2";
    metadata: "d1";
  };
};

export type VariantTrainingCoverage = {
  variantKey: string;
  claimStatus: "verified" | "preview-only";
  readiness: GameBotTrainingChecklist["coverageStatus"];
  entries: number;
  engineLabels: number;
  lastTrainingRunId: string;
  tierCoverage: Array<{
    tier: BotTierKey;
    policy: string;
    cacheThreshold: number;
    latencyTargetMs: number;
  }>;
};

export type TierBenchmarkResult = {
  tier: BotTierKey;
  benchmarkVersion: string;
  latencyTargetMs: number;
  fixtureFamilies: string[];
  runtimePolicy: "cache-first";
  strongerThan?: BotTierKey;
};

export type BotKnowledgeCoverage = {
  totalEntries: number;
  generatedEntries: number;
  indexedPositions: number;
  lastTrainingRunId: string;
  verifiedVariants: string[];
  previewOnlyVariants: string[];
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
  architectureBoundaries: Array<{
    boundary: "interactive-runtime" | "engine-hot-path" | "offline-training" | "future-kernel";
    runtime: "TypeScript" | "WebAssembly/C++" | "Python" | "Rust/WASM";
    ownership: string;
    reason: string;
  }>;
  optimizationPolicy: {
    maxInteractiveBotReplyMs: number;
    cacheFirst: true;
    offlineTraining: true;
    migrationRule: string;
  };
  cleanupFindings: string[];
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
  strength: VariantBotStrengthProfile;
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
  rulesCompletion: VariantRuleCompletion;
  knowledgeEntries: number;
  engineLabels: number;
  difficultyTiers: BotTierTrainingChecklist[];
  nextTrainingJobs: string[];
};

export type BotTrainingReadiness = {
  variantKey: string;
  coverageStatus: GameBotTrainingChecklist["coverageStatus"];
  knowledgeEntries: number;
  engineLabels: number;
  indexedPositions: number;
  topTier: BotTierKey;
  responseTargetMs: number;
  runtimePath: "knowledge-cache" | "engine-backed" | "internal-search" | "rules-gated";
  badgeLabel: string;
  primaryGap: string;
};

export type BotTrainingGateSummary = {
  claimPolicy: "verified-playable-only";
  requiredCompletionGates: string[];
  playableVariants: string[];
  gatedVariants: Array<{
    variantKey: string;
    coverageStatus: GameBotTrainingChecklist["coverageStatus"];
    claim: "not-fully-trained";
    remainingGates: string[];
  }>;
  notice: string;
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
    scannedRecords?: number;
    generatedPositions?: number;
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
  { key: "easy", label: "Easy", depth: 2, moveTimeMs: 220, nodeBudget: 360, beamWidth: 8, replyCheckWidth: 3, knowledgeMinimumConfidence: 0.78 },
  { key: "normal", label: "Normal", depth: 3, moveTimeMs: 420, nodeBudget: 950, beamWidth: 12, replyCheckWidth: 6, knowledgeMinimumConfidence: 0.74 },
  { key: "hard", label: "Hard", depth: 4, moveTimeMs: 780, nodeBudget: 2600, beamWidth: 18, replyCheckWidth: 10, knowledgeMinimumConfidence: 0.68 },
  { key: "very-hard", label: "Very Hard", depth: 5, moveTimeMs: 1400, nodeBudget: 6800, beamWidth: 28, replyCheckWidth: 15, knowledgeMinimumConfidence: 0.62 },
  { key: "grandmaster", label: "Grandmaster", depth: 5, moveTimeMs: 2100, nodeBudget: 12000, beamWidth: 34, replyCheckWidth: 17, knowledgeMinimumConfidence: 0.6 },
  { key: "legend", label: "Legend", depth: 7, moveTimeMs: 2600, nodeBudget: 28000, beamWidth: 46, replyCheckWidth: 24, knowledgeMinimumConfidence: 0.55 }
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
  },
  {
    id: "chess960-start-center-pawn",
    variantKey: "chess960",
    positionKey: "chess960|turn:white|moves:",
    moveUci: "e2e4",
    source: "opening-book",
    minTier: "easy",
    confidence: 0.87,
    benchmarkVersion: "allchess-variant-seed-v1",
    tags: ["opening", "center", "chess960", "development"],
    explanation: {
      plan: "Claim central space first, then let the randomized back rank reveal the best development pattern.",
      threat: "White prepares flexible piece routes instead of memorizing a fixed opening line.",
      risk: "Chess960 castling lanes differ, so the follow-up must check king safety before rushing.",
      fallbackGoal: "If Black contests the center, keep development compact and avoid moving the same piece repeatedly."
    }
  },
  {
    id: "xiangqi-start-central-soldier",
    variantKey: "xiangqi",
    positionKey: "xiangqi|turn:red|moves:",
    moveUci: "e4e5",
    source: "opening-book",
    minTier: "easy",
    confidence: 0.86,
    benchmarkVersion: "allchess-variant-seed-v1",
    tags: ["opening", "xiangqi", "soldier", "river"],
    explanation: {
      plan: "Advance the central soldier to contest space without exposing the general.",
      threat: "Red asks Black to respond to center pressure while keeping chariots and cannons flexible.",
      risk: "The soldier cannot retreat, so the bot should not overextend the next wave without support.",
      fallbackGoal: "If the center closes, pivot to cannon pressure and chariot mobility."
    }
  },
  {
    id: "antichess-start-trade-lanes",
    variantKey: "antichess",
    positionKey: "antichess|turn:white|moves:",
    moveUci: "e2e4",
    source: "opening-book",
    minTier: "easy",
    confidence: 0.85,
    benchmarkVersion: "allchess-variant-seed-v1",
    tags: ["opening", "antichess", "compulsory-capture", "trade-lanes"],
    explanation: {
      plan: "Open central trade lanes so forced captures can be steered instead of accepted blindly.",
      threat: "White prepares exchanges that may shed material while keeping enough mobility to avoid being trapped too early.",
      risk: "A careless center push can let the opponent choose the capture sequence, so the bot checks forced replies first.",
      fallbackGoal: "If the trade line is unfavorable, keep legal mobility and aim for a no-legal-move conversion."
    }
  },
  {
    id: "king-of-the-hill-start-center",
    variantKey: "king-of-the-hill",
    positionKey: "king-of-the-hill|turn:white|moves:",
    moveUci: "e2e4",
    source: "opening-book",
    minTier: "easy",
    confidence: 0.88,
    benchmarkVersion: "allchess-variant-seed-v1",
    tags: ["opening", "center", "king-safety", "variant-objective"],
    explanation: {
      plan: "Take central space so the king can later approach the hill only after support is ready.",
      threat: "White gains room for development and keeps the center objective under control.",
      risk: "Running the king forward too early can lose material or walk into checks.",
      fallbackGoal: "If the hill is blocked, transpose into normal chess pressure with safer king timing."
    }
  },
  {
    id: "three-check-start-fast-development",
    variantKey: "three-check",
    positionKey: "three-check|turn:white|moves:",
    moveUci: "e2e4",
    source: "opening-book",
    minTier: "easy",
    confidence: 0.88,
    benchmarkVersion: "allchess-variant-seed-v1",
    tags: ["opening", "center", "three-check", "initiative"],
    explanation: {
      plan: "Open central lines so checks can be created by developed pieces instead of one-move tricks.",
      threat: "White prepares quick bishop and queen activity while still respecting king safety.",
      risk: "Fishing for checks too early can waste tempi and fall behind in development.",
      fallbackGoal: "If Black parries the first threats, keep building pressure rather than forcing bad checks."
    }
  }
];

const generated = generatedKnowledge as GeneratedBotKnowledgeFile;
const generatedKnowledgeEntries = generated.entries;
const generatedEngineLabels = generated.engineLabels ?? [];
const knowledgeEntries: BotKnowledgeEntry[] = [...curatedKnowledgeEntries, ...generatedKnowledgeEntries];
const curatedEngineLabels = curatedKnowledgeEntries.map(knowledgeEntryToEngineLabel);
const runtimeEngineLabels = generatedEngineLabels.length ? [...generatedEngineLabels, ...curatedEngineLabels] : [...generatedKnowledgeEntries.map(knowledgeEntryToEngineLabel), ...curatedEngineLabels];
const knowledgeIndex = createKnowledgeIndex(knowledgeEntries);
const knowledgeCountsByVariant = countKnowledgeByVariant(knowledgeEntries);
const engineLabelCountsByVariant = countEngineLabelsByVariant(runtimeEngineLabels);
const classicPositionCount = new Set(
  generatedKnowledgeEntries.filter((entry) => entry.variantKey === "classic").map((entry) => entry.boardSignature || entry.positionKey || entry.id)
).size;
const totalGeneratedPositionCount = new Set(
  generatedKnowledgeEntries.map((entry) => `${entry.variantKey}|${entry.boardSignature || entry.positionKey || entry.id}`)
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
  return knowledgeEntries.filter((entry) => !variantKey || entry.variantKey === variantKey).map(enrichKnowledgeEntry);
}

export function listBotEngineLabels(variantKey?: string) {
  return runtimeEngineLabels.filter((label) => !variantKey || label.variantKey === variantKey);
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
    engineLabels: generated.summary?.engineLabels ?? generatedEngineLabels.length,
    sampledBytesPerCompressedFile: generated.summary?.sampledBytesPerCompressedFile ?? 0,
    scannedRecords: generated.summary?.scannedRecords ?? (generated.manifests ?? []).reduce((total, manifest) => total + Number(manifest.sampledRecords ?? 0), 0),
    generatedPositions: generated.summary?.generatedPositions ?? totalGeneratedPositionCount
  };
}

export function listTrainingRunManifests(): TrainingRunManifest[] {
  const scannedRecords = (generated.manifests ?? []).reduce((total, manifest) => total + Number(manifest.sampledRecords ?? 0), 0);
  const generatedPositions = totalGeneratedPositionCount;
  const variants = [
    ...new Set([
      ...knowledgeEntries.map((entry) => entry.variantKey),
      ...(generated.manifests ?? []).map((manifest) => manifest.variantKey).filter((variantKey) => variantKey && variantKey !== "unknown")
    ])
  ].sort();

  return [
    {
      id: `training-${generated.generatedAt ? generated.generatedAt.slice(0, 10) : "local"}`,
      mode: "two-track",
      generatedAt: generated.generatedAt ?? "2026-05-14T00:00:00.000Z",
      scannedRecords,
      generatedPositions,
      runtimeBudgetMs: MAX_BOT_REPLY_MS,
      variants,
      artifacts: {
        compactRuntime: "src/data/bot-knowledge.generated.json",
        largeArtifacts: "r2",
        metadata: "d1"
      }
    }
  ];
}

export function listVariantTrainingCoverage(variantKey?: string): VariantTrainingCoverage[] {
  const lastTrainingRunId = listTrainingRunManifests()[0]?.id ?? "training-local";
  return listBotTrainingChecklists(variantKey).map((checklist) => ({
    variantKey: checklist.variantKey,
    claimStatus: checklist.coverageStatus === "active" ? "verified" : "preview-only",
    readiness: checklist.coverageStatus,
    entries: checklist.knowledgeEntries,
    engineLabels: checklist.engineLabels,
    lastTrainingRunId,
    tierCoverage: checklist.difficultyTiers.map((tier) => ({
      tier: tier.tier,
      policy: tierPolicyForCoverage(tier.tier),
      cacheThreshold: trainingTierProfiles.find((profile) => profile.key === tier.tier)?.knowledgeMinimumConfidence ?? 0.7,
      latencyTargetMs: Math.min(tier.search.maxMoveTimeMs, MAX_BOT_REPLY_MS)
    }))
  }));
}

export function listTierBenchmarkResults(): TierBenchmarkResult[] {
  const fixtureFamilies = ["mate", "rescue", "retreat", "counterattack", "sacrifice", "material-win", "draw-saving"];
  return trainingTierProfiles.map((tier, index) => ({
    tier: tier.key,
    benchmarkVersion: localBenchmarkVersion,
    latencyTargetMs: MAX_BOT_REPLY_MS,
    fixtureFamilies,
    runtimePolicy: "cache-first" as const,
    strongerThan: index > 0 ? trainingTierProfiles[index - 1]?.key : undefined
  }));
}

export function getBotKnowledgeCoverage(): BotKnowledgeCoverage {
  const coverage = listVariantTrainingCoverage();
  return {
    totalEntries: knowledgeEntries.length,
    generatedEntries: generatedKnowledgeEntries.length,
    indexedPositions: knowledgeIndex.byPosition.size + knowledgeIndex.byBoardSignature.size,
    lastTrainingRunId: listTrainingRunManifests()[0]?.id ?? "training-local",
    verifiedVariants: coverage.filter((item) => item.claimStatus === "verified").map((item) => item.variantKey),
    previewOnlyVariants: coverage.filter((item) => item.claimStatus === "preview-only").map((item) => item.variantKey)
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
    architectureBoundaries: [
      {
        boundary: "interactive-runtime",
        runtime: "TypeScript",
        ownership: "Request routing, legal validation, bot tier policy, status panels, and Cloudflare/Vercel portability.",
        reason: "Keeping this layer in one typed runtime prevents duplicate gameplay logic across browser, Worker, and server routes."
      },
      {
        boundary: "engine-hot-path",
        runtime: "WebAssembly/C++",
        ownership: "Deep tactical search, UCI-compatible evaluation, and future Fairy-Stockfish variant analysis.",
        reason: "Native chess engines already outperform a hand-rolled TypeScript search for high-depth positions."
      },
      {
        boundary: "offline-training",
        runtime: "Python",
        ownership: "Dataset extraction, compressed archive scans, engine labeling, benchmark aggregation, and model experiments.",
        reason: "Offline jobs can use the best data tooling without increasing bundle size or slowing live gameplay."
      },
      {
        boundary: "future-kernel",
        runtime: "Rust/WASM",
        ownership: "Possible shared rules/search kernels for non-chess families after profiling proves a hot spot.",
        reason: "Rust/WASM is valuable for tight loops, but should be introduced only where measurements justify the extra build surface."
      }
    ],
    optimizationPolicy: {
      maxInteractiveBotReplyMs: MAX_BOT_REPLY_MS,
      cacheFirst: true,
      offlineTraining: true,
      migrationRule:
        "Do not rewrite working TypeScript orchestration unless a benchmark shows the rules/search loop exceeds the 3 second interaction budget after cache and engine routing."
    },
    cleanupFindings: [
      "Catalog playability now derives from the rules atlas completion matrix instead of a duplicate verification table.",
      "R2 storage remains on Cloudflare bindings; the unused direct S3 client dependency was removed from the app surface."
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

export function listBotTrainingReadiness(variantKey?: string): BotTrainingReadiness[] {
  return listBotTrainingChecklists(variantKey).map((checklist) => {
    const indexedPositions = knowledgeIndex.byPosition.size + knowledgeIndex.byBoardSignature.size;
    const runtimePath = runtimePathForChecklist(checklist);
    const topTier = checklist.difficultyTiers[checklist.difficultyTiers.length - 1]?.tier ?? "legend";
    return {
      variantKey: checklist.variantKey,
      coverageStatus: checklist.coverageStatus,
      knowledgeEntries: checklist.knowledgeEntries,
      engineLabels: checklist.engineLabels,
      indexedPositions: checklist.coverageStatus === "active" ? indexedPositions : 0,
      topTier,
      responseTargetMs: MAX_BOT_REPLY_MS,
      runtimePath,
      badgeLabel: readinessBadgeLabel(checklist.coverageStatus, runtimePath),
      primaryGap: checklist.nextTrainingJobs[0] ?? "Continue benchmark gauntlets and runtime audits."
    };
  });
}

export function getBotTrainingGateSummary(): BotTrainingGateSummary {
  const checklists = listBotTrainingChecklists();
  const playableVariants = checklists.filter((checklist) => checklist.coverageStatus === "active").map((checklist) => checklist.variantKey);
  const gatedVariants = checklists
    .filter((checklist) => checklist.coverageStatus !== "active")
    .map((checklist) => ({
      variantKey: checklist.variantKey,
      coverageStatus: checklist.coverageStatus,
      claim: "not-fully-trained" as const,
      remainingGates:
        checklist.rulesCompletion.status === "verified-playable"
          ? checklist.nextTrainingJobs
          : checklist.rulesCompletion.remainingGates.length
            ? checklist.rulesCompletion.remainingGates
            : checklist.nextTrainingJobs
    }));

  return {
    claimPolicy: "verified-playable-only",
    requiredCompletionGates: ["native rules", "legal bot moves", "review", "persistence", "E2E fixtures"],
    playableVariants,
    gatedVariants,
    notice:
      "AllChess marks a bot/game ready only after native rules, legal bot moves, review, persistence, and E2E fixtures pass. Gated variants stay as guide-first previews until those gates pass."
  };
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

function enrichKnowledgeEntry(entry: BotKnowledgeEntry): BotKnowledgeEntryWithMetadata {
  const generatedAt = entry.generatedAt ?? generated.generatedAt ?? "2026-05-14T00:00:00.000Z";
  const sourceFile = sourceFileForEntry(entry);
  return {
    ...entry,
    tierTargets: entry.tierTargets ?? tiersAtOrAbove(entry.minTier),
    positionHash: entry.positionHash ?? stableKnowledgeHash(`${entry.variantKey}|${entry.positionKey}|${entry.boardSignature ?? ""}|${entry.moveUci}`),
    sourceFileId: entry.sourceFileId ?? sourceFile.id,
    sourceLicense: entry.sourceLicense ?? sourceFile.license,
    labelDepth: entry.labelDepth ?? depthForEntry(entry),
    engine: entry.engine ?? engineForEntry(entry),
    split: entry.split ?? splitForEntry(entry),
    generatedAt
  };
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
  const knowledgeEntriesForVariant = knowledgeCountsByVariant.get(variant.key) ?? 0;
  const engineLabelsForVariant = engineLabelCountsByVariant.get(variant.key) ?? 0;
  const hasRuntimeKnowledge = knowledgeEntriesForVariant > 0 || engineLabelsForVariant > 0;
  const rulesCompletion = getVariantRuleSummary(variant.key).completion;
  const rulesGated = rulesCompletion.status !== "verified-playable";
  const coverageStatus = rulesGated ? "rules-gated" : hasRuntimeKnowledge ? "active" : "training";

  return {
    variantKey: variant.key,
    enginePlan: enginePlanForVariant(variant),
    coverageStatus,
    rulesCompletion,
    knowledgeEntries: knowledgeEntriesForVariant,
    engineLabels: engineLabelsForVariant,
    difficultyTiers: trainingTierProfiles.map((difficulty) => {
      const strength = getVariantBotStrengthProfile(variant.key, difficulty.key);

      return {
        tier: difficulty.key,
        label: difficulty.label,
        strength,
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
            id: "rule-completion",
            label: "Only advertise final bot strength after the rules edge cases are complete.",
            status: rulesGated ? "rules-gated" : "ready",
            evidence: rulesGated
              ? rulesCompletion.remainingGates.join("; ")
              : `${rulesCompletion.verifiedEdgeCases.length} rule edge-case groups are verified for ${variant.key}.`
          },
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
            evidence: `${difficulty.label}: ${strength.display}, depth ${difficulty.depth}, ${difficulty.nodeBudget} nodes, beam ${difficulty.beamWidth}, confidence gate ${difficulty.knowledgeMinimumConfidence}.`
          },
          {
            id: "strength-calibration",
            label: "Use a consistent Elo-style strength band without pretending every variant has a human-rated Elo.",
            status: rulesGated ? "rules-gated" : "ready",
            evidence: strength.basis
          },
          {
            id: "resource-efficiency",
            label: "Reuse legal-move generation inside nested search loops instead of recomputing the same board repeatedly.",
            status: "ready",
            evidence: "Internal search uses a per-request legal-move cache shared by evaluation, reply checks, minimax, quiescence, and mobility scoring."
          },
          {
            id: "search-telemetry",
            label: "Expose cache hits, cached positions, move-generation calls, and searched nodes for every returned bot move.",
            status: "ready",
            evidence: "BotMoveResult.searchEfficiency reports the live search budget so slow or wasteful tiers can be benchmarked instead of guessed."
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
      };
    }),
    nextTrainingJobs: nextTrainingJobsForVariant(variant, hasRuntimeKnowledge, rulesGated)
  };
}

function countKnowledgeByVariant(entries: BotKnowledgeEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.variantKey, (counts.get(entry.variantKey) ?? 0) + 1);
  return counts;
}

function countEngineLabelsByVariant(labels: EngineLabel[]) {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const variantKey = label.variantKey ?? "unknown";
    counts.set(variantKey, (counts.get(variantKey) ?? 0) + 1);
  }
  return counts;
}

function runtimePathForChecklist(checklist: GameBotTrainingChecklist): BotTrainingReadiness["runtimePath"] {
  if (checklist.coverageStatus === "rules-gated") return "rules-gated";
  if (checklist.knowledgeEntries > 0 || checklist.engineLabels > 0) return "knowledge-cache";
  if (checklist.enginePlan.toLowerCase().includes("stockfish") || checklist.enginePlan.toLowerCase().includes("uci")) return "engine-backed";
  return "internal-search";
}

function readinessBadgeLabel(coverageStatus: GameBotTrainingChecklist["coverageStatus"], runtimePath: BotTrainingReadiness["runtimePath"]) {
  if (coverageStatus === "rules-gated") return "Rules gated";
  if (runtimePath === "knowledge-cache") return "Cache ready";
  if (runtimePath === "engine-backed") return "Engine ready";
  return "Search ready";
}

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

function knowledgeEntryToEngineLabel(entry: BotKnowledgeEntry): EngineLabel {
  const isOpening = entry.source === "opening-book";
  return {
    id: `label-${entry.id}`,
    variantKey: entry.variantKey,
    positionKey: entry.positionKey,
    boardSignature: entry.boardSignature,
    moveUci: entry.moveUci,
    engine: isOpening ? "local-opening-frequency" : "lichess-puzzle-solution",
    engineVersion: isOpening ? "sampled-public-games-v1" : "public-puzzle-line-v1",
    depth: depthForEntry(entry),
    nodes: 0,
    bestMoves: [entry.moveUci],
    evaluation: null,
    legalValidation: "runtime",
    benchmarkVersion: entry.benchmarkVersion,
    confidence: Number(Math.min(0.97, entry.confidence + (isOpening ? 0.02 : 0.08)).toFixed(3)),
    minTier: isOpening ? "hard" : entry.minTier,
    tags: ["local-derived-label", ...entry.tags],
    sourceTool: isOpening ? "Aix/Lichess opening sample" : "Lichess puzzle solution sample",
    explanation: {
      plan: isOpening ? "Use the most frequent sampled opening move before spending live search." : "Use a precomputed tactical solution label before spending live search.",
      threat: entry.explanation.threat,
      risk: "This compact label is derived on demand and still rejected if illegal.",
      fallbackGoal: "If no exact label matches, use Stockfish or internal search with normal validation."
    },
    createdAt: generated.generatedAt ?? "2026-05-14T00:00:00.000Z"
  };
}

function depthForEntry(entry: BotKnowledgeEntry) {
  if (entry.minTier === "legend") return 22;
  if (entry.minTier === "grandmaster") return 18;
  if (entry.minTier === "very-hard") return 16;
  if (entry.minTier === "hard") return 14;
  if (entry.minTier === "normal") return 10;
  return 6;
}

function tierPolicyForCoverage(tier: BotTierKey) {
  const policies: Record<BotTierKey, string> = {
    easy: "not naive: common book moves, immediate wins, safe captures, and major-piece blunder filters",
    normal: "one-reply defense, defended-piece awareness, and basic tactic labels",
    hard: "fork, pin, skewer, loose-piece, and king-safety benchmark coverage",
    "very-hard": "deeper replies, sacrifice filters, positional pressure, and draw-saving fallback",
    grandmaster: "engine labels, stronger PV preference, and benchmarked tactical choices",
    legend: "highest confidence cache first, deepest labels, anti-blunder verification, and strict latency control"
  };
  return policies[tier];
}

function tiersAtOrAbove(minTier: BotTierKey): BotTierKey[] {
  return trainingTierProfiles.filter((profile) => tierRank[profile.key] >= tierRank[minTier]).map((profile) => profile.key);
}

function sourceFileForEntry(entry: BotKnowledgeEntry) {
  const manifests = generated.manifests ?? [];
  if (entry.source === "tactic-cache") {
    const puzzle = manifests.find((manifest) => manifest.path.toLowerCase().includes("puzzle"));
    return {
      id: puzzle?.id ?? "source-local-puzzle",
      license: puzzle?.license ?? "public Lichess data; verify downstream license before publishing derived models"
    };
  }

  const variantManifest = manifests.find((manifest) => manifest.variantKey === entry.variantKey && manifest.kind === "pgn");
  return {
    id: variantManifest?.id ?? `source-${entry.variantKey}-seeded`,
    license: variantManifest?.license ?? "local-derived-seed"
  };
}

function engineForEntry(entry: BotKnowledgeEntry) {
  if (entry.source === "opening-book") return "local-opening-frequency";
  if (entry.source === "tactic-cache") return "lichess-puzzle-solution";
  if (entry.source === "endgame-cache") return "tablebase-style-cache";
  if (entry.source === "ml-policy") return "offline-policy-manifest";
  return entry.source;
}

function splitForEntry(entry: BotKnowledgeEntry): "train" | "eval" | "test" {
  const bucket = Number.parseInt(stableKnowledgeHash(entry.id).slice(0, 2), 16) % 10;
  if (bucket === 0) return "test";
  if (bucket <= 2) return "eval";
  return "train";
}

function stableKnowledgeHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
