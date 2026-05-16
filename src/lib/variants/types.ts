export type PlayerColor = "white" | "black" | "red" | "blue" | "sente" | "gote";

export type Square = {
  row: number;
  col: number;
};

export type Piece = {
  id: string;
  code: string;
  labelKey: string;
  owner: PlayerColor;
  promoted?: boolean;
};

export type BoardCell = {
  square: Square;
  terrain?: "land" | "river" | "palace" | "camp" | "den" | "trap" | "promotion-zone";
  piece: Piece | null;
};

export type Move = {
  kind?: "move" | "drop";
  from: Square;
  to: Square;
  promotion?: boolean;
  drop?: Piece;
};

export type PlayerClock = {
  color: PlayerColor;
  remainingMs: number;
  incrementMs: number;
};

export type GameState = {
  id: string;
  variantKey: string;
  board: BoardCell[][];
  turn: PlayerColor;
  ply: number;
  status: "waiting" | "active" | "completed";
  result?: "draw" | "white" | "black" | "red" | "blue" | "sente" | "gote";
  outcomeReason?:
    | "checkmate"
    | "stalemate"
    | "timeout"
    | "three-check"
    | "objective"
    | "royal-captured"
    | "lost-all-pieces"
    | "no-legal-moves"
    | "insufficient-material"
    | "fifty-move"
    | "draw";
  moves: Array<Move & { notation: string }>;
  clocks: PlayerClock[];
  captured: Piece[];
  checks: Partial<Record<PlayerColor, number>>;
  halfmoveClock: number;
  hands?: Partial<Record<PlayerColor, Record<string, number>>>;
  variantState?: Record<string, unknown>;
  review?: {
    summaryId?: string;
    completedAt?: string;
  };
};

export type MoveReview = {
  classification: "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  detail: string;
};

export type RulesAdapter = {
  createInitialState: (variantKey: string, id?: string) => GameState;
  getLegalMoves: (state: GameState, fromOrHand: Square | { drop: Piece }) => Move[];
  applyMove: (state: GameState, move: Move) => GameState;
  getOutcome: (state: GameState) => Pick<GameState, "status" | "result" | "outcomeReason">;
  toNotation: (state: GameState, move: Move) => string;
  reviewMove: (before: GameState, move: Move, after: GameState) => MoveReview;
};

export type VariantDefinition = {
  key: string;
  nameKey: string;
  rulesAdapter: "chessops" | "xiangqiops" | "shogiops" | "makruk-js" | "allchess-janggi" | "allchess-jungle";
  engineProtocol: "uci" | "usi" | "internal";
  family: "western" | "east-asian" | "southeast-asian" | "abstract";
  board: {
    rows: number;
    cols: number;
    coordinates: "orthodox" | "xiangqi" | "shogi" | "jungle";
  };
  players: PlayerColor[];
  supportsDrops: boolean;
  supportsPromotion: boolean;
  supportsCastling: boolean;
  supportsCheck: boolean;
  objective: string;
  startFen?: string;
  setup: string[];
  aliases: string[];
};
