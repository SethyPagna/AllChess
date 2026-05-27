import type { VariantDefinition } from "@/lib/variants";

export type GameFamilyKey =
  | "chess-family"
  | "asian-chess"
  | "draughts"
  | "mancala"
  | "go-family"
  | "tables"
  | "tafl"
  | "race"
  | "mill"
  | "regional";

export type PlayabilityStatus = "playable" | "learn" | "coming-soon";

export type BoardGeometry =
  | { kind: "square-grid"; rows: number; cols: number; description: string }
  | { kind: "intersection-grid"; rows: number; cols: number; description: string }
  | { kind: "hex-grid"; rings: number; description: string }
  | { kind: "cross-path"; arms: number; pathLength: number; description: string }
  | { kind: "pit-row"; rows: number; pitsPerRow: number; stores?: number; description: string }
  | { kind: "triangular-points"; points: number; description: string }
  | { kind: "concentric-lines"; intersections: number; description: string }
  | { kind: "irregular-path"; spaces: number; description: string };

export type PiecePresentationPack =
  | "staunton-svg"
  | "shogi-koma"
  | "xiangqi-disk"
  | "jungle-animals"
  | "makruk-carved"
  | "draughts-stacks"
  | "mancala-seeds"
  | "go-stones"
  | "backgammon-checkers"
  | "tafl-runes"
  | "race-pawns"
  | "mill-stones";

export type RulesEngineAdapter =
  | VariantDefinition["rulesAdapter"]
  | "draughts-engine"
  | "mancala-engine"
  | "go-engine"
  | "tables-engine"
  | "tafl-engine"
  | "race-engine"
  | "mill-engine"
  | "planned-rules-engine";

export type BotEngineAdapter =
  | "stockfish"
  | "fairy-stockfish"
  | "internal-search"
  | "mcts"
  | "heuristic"
  | "none";

export type GameNamePack = {
  english: string;
  native?: string;
  romanization?: string;
  short?: string;
};

export type GameCatalogEntry = {
  id: string;
  variantKey?: string;
  name: GameNamePack;
  aliases: string[];
  family: GameFamilyKey;
  region: string[];
  board: BoardGeometry;
  piecePresentation: PiecePresentationPack;
  playability: PlayabilityStatus;
  rulesAdapter: RulesEngineAdapter;
  botAdapter: BotEngineAdapter;
  learningStatus: "ready" | "draft" | "researching";
  ruleSourceLinks: Array<{ name: string; url: string }>;
  shortRules: string[];
  winConditions: string[];
  reviewFocus: string[];
  recommendations: string[];
  verification?: PlayableGameVerification;
};

export type PlayableGameVerification = {
  rulesComplete: boolean;
  botComplete: boolean;
  reviewComplete: boolean;
  persistenceComplete: boolean;
  e2eComplete: boolean;
  knownGaps: string[];
};

export type BotBenchmarkRun = {
  id: string;
  gameId: string;
  tier: "easy" | "normal" | "hard" | "very-hard" | "grandmaster" | "legend";
  engine: BotEngineAdapter;
  benchmarkVersion: string;
  positions: number;
  legalMoveRate: number;
  completedAt: string;
};

export type LeaderboardScope = {
  id: string;
  label: string;
  family?: GameFamilyKey;
  gameId?: string;
  ratedOnly: boolean;
};

export type CatalogStats = {
  totalGames: number;
  playableGames: number;
  learnGames: number;
  comingSoonGames: number;
  familyCounts: Record<GameFamilyKey, number>;
};
