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
  moves: Array<Move & { notation: string }>;
  clocks: PlayerClock[];
  captured: Piece[];
  checks: Partial<Record<PlayerColor, number>>;
};

export type VariantDefinition = {
  key: string;
  nameKey: string;
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
