import { moveToUci } from "@/lib/stockfish-engine";
import { getLegalMoves, type GameState, type Move } from "@/lib/variants";
import type { BotTierKey } from "@/lib/bots";

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
  engine: string;
  depth: number;
  nodes: number;
  bestMoves: string[];
  evaluation: number | null;
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

export type BotKnowledgeEntry = {
  id: string;
  variantKey: string;
  positionKey: string;
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

const tierRank: Record<BotTierKey, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  "very-hard": 3,
  grandmaster: 4,
  legend: 5
};

const knowledgeEntries: BotKnowledgeEntry[] = [
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

const modelManifests: BotModelManifest[] = [
  {
    id: "allchess-classic-policy-v1",
    variantKey: "classic",
    tier: "grandmaster",
    version: "classic-policy-v1",
    status: "planned",
    storage: "r2",
    objectKey: "bot-models/classic/policy-v1/manifest.json",
    positionCount: 0,
    benchmarkVersion: "allchess-knowledge-v1",
    sourceManifestIds: ["lichess-public-license-reviewed", "allchess-selfplay-v1"],
    createdAt: "2026-05-14T00:00:00.000Z"
  },
  {
    id: "allchess-universal-tactics-v1",
    variantKey: "all-playable",
    tier: "legend",
    version: "universal-tactics-v1",
    status: "planned",
    storage: "r2",
    objectKey: "bot-models/universal/tactics-v1/manifest.json",
    positionCount: 0,
    benchmarkVersion: "allchess-knowledge-v1",
    sourceManifestIds: ["engine-generated-tactics-v1", "opt-in-user-games-v1"],
    createdAt: "2026-05-14T00:00:00.000Z"
  }
];

export function createBotPositionKey(state: GameState) {
  return `${state.variantKey}|turn:${state.turn}|moves:${state.moves.map((move) => moveToUci(state, move)).join(" ")}`;
}

export function listBotKnowledge(variantKey?: string) {
  return knowledgeEntries.filter((entry) => !variantKey || entry.variantKey === variantKey);
}

export function listBotModelManifests() {
  return modelManifests;
}

export function lookupBotKnowledge(state: GameState, tier: BotTierKey): BotKnowledgeHit | null {
  if (state.status !== "active") return null;

  const key = createBotPositionKey(state);
  const entries = knowledgeEntries
    .filter((entry) => entry.variantKey === state.variantKey && entry.positionKey === key && tierRank[tier] >= tierRank[entry.minTier])
    .sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source) || b.confidence - a.confidence);

  for (const entry of entries) {
    const move = legalMoveByUci(state, entry.moveUci);
    if (move) {
      return { entry, move, principalVariation: [entry.moveUci] };
    }
  }

  return null;
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
