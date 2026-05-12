import type { VariantDefinition } from "./types";

export const variantCatalog: VariantDefinition[] = [
  {
    key: "classic",
    nameKey: "variant.classic",
    family: "western",
    board: { rows: 8, cols: 8, coordinates: "orthodox" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: true,
    supportsCastling: true,
    supportsCheck: true,
    objective: "Checkmate the opponent king.",
    startFen: "start",
    setup: ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"],
    aliases: ["standard", "fide"]
  },
  {
    key: "chess960",
    nameKey: "variant.chess960",
    family: "western",
    board: { rows: 8, cols: 8, coordinates: "orthodox" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: true,
    supportsCastling: true,
    supportsCheck: true,
    objective: "Checkmate with randomized back ranks.",
    setup: ["nrkbqrbn", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "NRKBQRBN"],
    aliases: ["fischer-random"]
  },
  {
    key: "xiangqi",
    nameKey: "variant.xiangqi",
    family: "east-asian",
    board: { rows: 10, cols: 9, coordinates: "xiangqi" },
    players: ["red", "black"],
    supportsDrops: false,
    supportsPromotion: false,
    supportsCastling: false,
    supportsCheck: true,
    objective: "Checkmate or stalemate the opposing general.",
    setup: ["rheagaehr", ".........", ".c.....c.", "p.p.p.p.p", ".........", ".........", "P.P.P.P.P", ".C.....C.", ".........", "RHEAGAEHR"],
    aliases: ["chinese-chess"]
  },
  {
    key: "shogi",
    nameKey: "variant.shogi",
    family: "east-asian",
    board: { rows: 9, cols: 9, coordinates: "shogi" },
    players: ["sente", "gote"],
    supportsDrops: true,
    supportsPromotion: true,
    supportsCastling: false,
    supportsCheck: true,
    objective: "Checkmate the opposing king using moves, drops, and promotions.",
    setup: ["lnsgkgsnl", ".r.....b.", "ppppppppp", ".........", ".........", ".........", "PPPPPPPPP", ".B.....R.", "LNSGKGSNL"],
    aliases: ["japanese-chess"]
  },
  {
    key: "janggi",
    nameKey: "variant.janggi",
    family: "east-asian",
    board: { rows: 10, cols: 9, coordinates: "xiangqi" },
    players: ["red", "blue"],
    supportsDrops: false,
    supportsPromotion: false,
    supportsCastling: false,
    supportsCheck: true,
    objective: "Checkmate the opposing general on a palace board.",
    setup: ["rheagaehr", ".........", ".c.....c.", "p.p.p.p.p", ".........", ".........", "P.P.P.P.P", ".C.....C.", ".........", "RHEAGAEHR"],
    aliases: ["korean-chess"]
  },
  {
    key: "makruk",
    nameKey: "variant.makruk",
    family: "southeast-asian",
    board: { rows: 8, cols: 8, coordinates: "orthodox" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: true,
    supportsCastling: false,
    supportsCheck: true,
    objective: "Checkmate with Thai chess movement and promotion rules.",
    setup: ["rnskksnr", "........", "pppppppp", "........", "........", "PPPPPPPP", "........", "RNSKKSNR"],
    aliases: ["thai-chess"]
  },
  {
    key: "jungle",
    nameKey: "variant.jungle",
    family: "abstract",
    board: { rows: 9, cols: 7, coordinates: "jungle" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: false,
    supportsCastling: false,
    supportsCheck: false,
    objective: "Enter the opponent den or capture all animals.",
    setup: ["L.....T", ".D...C.", "R.P.W.E", ".......", ".......", ".......", "E.W.P.R", ".C...D.", "T.....L"],
    aliases: ["dou-shou-qi"]
  },
  {
    key: "antichess",
    nameKey: "variant.antichess",
    family: "western",
    board: { rows: 8, cols: 8, coordinates: "orthodox" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: true,
    supportsCastling: false,
    supportsCheck: false,
    objective: "Lose all pieces; captures are compulsory.",
    setup: ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"],
    aliases: ["giveaway"]
  },
  {
    key: "horde",
    nameKey: "variant.horde",
    family: "western",
    board: { rows: 8, cols: 8, coordinates: "orthodox" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: true,
    supportsCastling: true,
    supportsCheck: true,
    objective: "The horde tries to overwhelm the standard army.",
    setup: ["rnbqkbnr", "pppppppp", "........", "PPPPPPPP", "PPPPPPPP", "PPPPPPPP", "PPPPPPPP", "........"],
    aliases: []
  },
  {
    key: "king-of-the-hill",
    nameKey: "variant.king-of-the-hill",
    family: "western",
    board: { rows: 8, cols: 8, coordinates: "orthodox" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: true,
    supportsCastling: true,
    supportsCheck: true,
    objective: "Checkmate or bring the king to a center square.",
    setup: ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"],
    aliases: ["koth"]
  },
  {
    key: "three-check",
    nameKey: "variant.three-check",
    family: "western",
    board: { rows: 8, cols: 8, coordinates: "orthodox" },
    players: ["white", "black"],
    supportsDrops: false,
    supportsPromotion: true,
    supportsCastling: true,
    supportsCheck: true,
    objective: "Checkmate or deliver three checks.",
    setup: ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"],
    aliases: ["3-check"]
  }
] satisfies VariantDefinition[];

export type VariantKey = (typeof variantCatalog)[number]["key"];

export function getVariant(key: string): VariantDefinition {
  const found = variantCatalog.find((variant) => variant.key === key || variant.aliases.includes(key));
  if (!found) {
    throw new Error(`Unknown variant: ${key}`);
  }
  return found;
}
