import { getVariant, variantCatalog } from "@/lib/variants";

export type RuleSourceLink = {
  name: string;
  url: string;
};

export type VariantRuleCompletionStatus = "verified-playable" | "rules-gated";

export type VariantRuleCompletion = {
  status: VariantRuleCompletionStatus;
  verifiedEdgeCases: string[];
  remainingGates: string[];
};

export type VariantRuleSummary = {
  variantKey: string;
  sourceLinks: RuleSourceLink[];
  numberedBasics: string[];
  specialRules: string[];
  winConditions: string[];
  drawConditions: string[];
  illegalMoveNotes: string[];
  completion: VariantRuleCompletion;
};

type VariantRuleSummaryBase = Omit<VariantRuleSummary, "completion">;

export const variantRuleSummaries: Record<string, VariantRuleSummaryBase> = {
  classic: {
    variantKey: "classic",
    sourceLinks: [{ name: "FIDE Laws of Chess", url: "https://rcc.fide.com/fide-laws-of-chess_fulltexthtml/" }],
    numberedBasics: [
      "Move pieces by FIDE rules.",
      "Kings cannot be captured; checkmate ends the game.",
      "Castling, promotion, en passant, check, stalemate, repetition, fifty-move, timeout, and insufficient material must be handled.",
      "Win by checkmate, resignation, or timeout with mating material."
    ],
    specialRules: ["Castling", "Promotion", "En passant", "Check and checkmate"],
    winConditions: ["Checkmate", "Timeout when the opponent has mating material", "Resignation"],
    drawConditions: ["Stalemate", "Insufficient material", "Repetition", "Fifty-move rule", "Mutual agreement"],
    illegalMoveNotes: ["A king may not move into check.", "A checked player must remove the check.", "Royal captures are never legal."]
  },
  chess960: {
    variantKey: "chess960",
    sourceLinks: [{ name: "FIDE Laws of Chess, Chess960 Guidelines", url: "https://rcc.fide.com/fide-laws-of-chess_fulltexthtml/" }],
    numberedBasics: [
      "Back rank starts randomized.",
      "Bishops start on opposite colors and king starts between rooks.",
      "Castling ends with normal king/rook destination squares.",
      "Checkmate/draw rules match classic chess."
    ],
    specialRules: ["Randomized legal start positions", "Chess960 castling", "Standard check and promotion"],
    winConditions: ["Checkmate", "Timeout with mating material", "Resignation"],
    drawConditions: ["Stalemate", "Insufficient material", "Repetition", "Fifty-move rule", "Mutual agreement"],
    illegalMoveNotes: ["Castling must obey check-through-check restrictions.", "Royal captures are never legal."]
  },
  xiangqi: {
    variantKey: "xiangqi",
    sourceLinks: [{ name: "World Xiangqi Federation World Xiangqi Rules 2018", url: "https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf" }],
    numberedBasics: [
      "Play on 9x10 intersections with palace and river.",
      "General, advisors, elephants, horses, chariots, cannons, and soldiers use native movement.",
      "Flying generals may not face each other on an open file.",
      "Checkmate or stalemate wins for the attacking side."
    ],
    specialRules: ["Palace confinement", "River limits", "Horse leg blocks", "Elephant eye blocks", "Cannon screen captures", "Flying general"],
    winConditions: ["Checkmate", "Stalemate against the side to move", "Timeout"],
    drawConditions: ["Perpetual/repetition according to selected rules mode", "Mutual agreement"],
    illegalMoveNotes: ["Generals may not face directly.", "A player may not ignore check.", "Blocked horse/elephant moves are illegal."]
  },
  shogi: {
    variantKey: "shogi",
    sourceLinks: [
      { name: "Japan Shogi Association basic rules", url: "https://www.shogi.or.jp/knowledge/shogi/02.html" },
      { name: "Japan Shogi Association tournament rules and illegal moves", url: "https://www.shogi.or.jp/event/Rules%20and%20regulations.pdf" }
    ],
    numberedBasics: [
      "Captured pieces become pieces in hand.",
      "Drops are legal except illegal pawn drops, non-moving drops, and pawn-drop mate.",
      "Promotion applies in the promotion zone.",
      "Checkmate wins; illegal moves lose in strict rules."
    ],
    specialRules: ["Piece drops", "Promotion zone", "Nifu pawn restriction", "Pawn-drop mate restriction"],
    winConditions: ["Checkmate", "Illegal move in strict competitive mode", "Resignation", "Timeout"],
    drawConditions: ["Repetition rules according to selected mode", "Impasse scoring in supported rules mode"],
    illegalMoveNotes: ["Do not drop a pawn on a file with an unpromoted friendly pawn.", "Do not drop a piece where it can never move.", "Do not leave your king in check."]
  },
  janggi: {
    variantKey: "janggi",
    sourceLinks: [{ name: "AllChess Janggi rules profile", url: "https://en.wikipedia.org/wiki/Janggi" }],
    numberedBasics: [
      "Play on a 9x10 intersection board with palaces.",
      "Generals, guards, elephants, horses, chariots, cannons, and soldiers use Janggi movement.",
      "Palace diagonals and facing-general rules must be implemented.",
      "Checkmate wins; repetition/pass/scoring policy must be locked to the selected AllChess ruleset."
    ],
    specialRules: ["Palace diagonals", "Cannon screens", "No river", "Facing generals", "Optional pass in rules mode"],
    winConditions: ["Checkmate", "Timeout", "Scoring decision in supported tournament mode"],
    drawConditions: ["Repetition/pass scoring according to AllChess rules mode", "Mutual agreement"],
    illegalMoveNotes: ["Generals may not face directly.", "Cannon movement requires the correct screen behavior.", "A player may not remain in check."]
  },
  makruk: {
    variantKey: "makruk",
    sourceLinks: [{ name: "GNU XBoard Makruk rules", url: "https://www.gnu.org/software/xboard/whats_new/rules/Makruk.html" }],
    numberedBasics: [
      "Thai chess uses chess-like pieces with different queen/bishop/pawn behavior.",
      "Pawns begin advanced and promote differently from western chess.",
      "No castling.",
      "Checkmate wins; Makruk counting/draw rules must be supported in rules mode."
    ],
    specialRules: ["No castling", "Makruk promotion", "Counting/draw mode"],
    winConditions: ["Checkmate", "Timeout", "Resignation"],
    drawConditions: ["Makruk counting rules in rules mode", "Stalemate or repetition according to selected mode"],
    illegalMoveNotes: ["No castling is allowed.", "Promotion follows Makruk piece rules.", "A king may not stay in check."]
  },
  jungle: {
    variantKey: "jungle",
    sourceLinks: [{ name: "Yellow Mountain Imports Dou Shou Qi rules", url: "https://ymimports.onsitesupport.io/yellowmountainimports/knowledge-base/article/how-to-play-jungle-dou-shou-qi-%E9%AC%A5%E7%8D%B8%E6%A3%8B" }],
    numberedBasics: [
      "Animals have ranks and capture by rank rules.",
      "Rat, river, trap, and den rules are native to the game.",
      "Win by entering the opponent den or eliminating all opponent animals.",
      "No check/checkmate concept."
    ],
    specialRules: ["Animal ranks", "River movement", "Rat exceptions", "Trap weakening", "Den objective"],
    winConditions: ["Enter the opponent den", "Capture all opposing animals"],
    drawConditions: ["Repetition or no-progress policy in AllChess rules mode"],
    illegalMoveNotes: ["Most animals may not enter river squares.", "Pieces may not enter their own den.", "Trap and rank rules control captures."]
  },
  antichess: {
    variantKey: "antichess",
    sourceLinks: [{ name: "Lichess antichess rules", url: "https://lichess.org/variant/antichess" }],
    numberedBasics: [
      "Goal is to lose all pieces.",
      "Captures are compulsory.",
      "King has no royal safety.",
      "Win by having no pieces or no legal move under the selected antichess ruleset."
    ],
    specialRules: ["Mandatory captures", "No check", "King is non-royal", "Promotion remains available"],
    winConditions: ["Lose all pieces", "Have no legal move under antichess rules"],
    drawConditions: ["Repetition/no-progress according to selected mode"],
    illegalMoveNotes: ["A non-capture is illegal when a capture exists.", "Check restrictions do not apply."]
  },
  horde: {
    variantKey: "horde",
    sourceLinks: [{ name: "Lichess horde rules", url: "https://lichess.org/variant/horde" }],
    numberedBasics: [
      "White plays a pawn horde; black has a normal army.",
      "White wins by checkmating black.",
      "Black wins by eliminating the horde.",
      "Draw/check rules follow the supported horde ruleset."
    ],
    specialRules: ["Asymmetric armies", "Horde elimination objective", "Standard black king safety"],
    winConditions: ["White checkmates black", "Black captures all horde pieces", "Timeout"],
    drawConditions: ["Stalemate/repetition/no-progress according to selected mode"],
    illegalMoveNotes: ["Black king safety still applies.", "Horde setup and promotion must remain valid."]
  },
  "king-of-the-hill": {
    variantKey: "king-of-the-hill",
    sourceLinks: [{ name: "Lichess King of the Hill rules", url: "https://lichess.org/variant/kingOfTheHill" }],
    numberedBasics: [
      "Normal chess rules apply.",
      "A player also wins by moving the king to a center square.",
      "Checkmate still wins.",
      "Draw rules match chess unless the center objective resolves first."
    ],
    specialRules: ["Center-square king objective", "Standard check and checkmate"],
    winConditions: ["Move king to the center", "Checkmate", "Timeout with mating material"],
    drawConditions: ["Standard chess draw rules unless objective is achieved first"],
    illegalMoveNotes: ["A king may not move into check, even when aiming for the hill."]
  },
  "three-check": {
    variantKey: "three-check",
    sourceLinks: [{ name: "Lichess Three-check rules", url: "https://lichess.org/variant/threeCheck" }],
    numberedBasics: [
      "Normal chess rules apply.",
      "Each delivered check is counted.",
      "A player wins after delivering three checks.",
      "Checkmate also wins before the third check if it occurs."
    ],
    specialRules: ["Check counter", "Standard chess movement", "Checkmate remains decisive"],
    winConditions: ["Deliver three checks", "Checkmate", "Timeout with mating material"],
    drawConditions: ["Standard chess draw rules unless three-check objective is reached first"],
    illegalMoveNotes: ["A player must still answer check.", "Royal captures are never legal."]
  }
};

const verifiedChessEdgeCases = [
  "Royal pieces cannot be captured in check-based games.",
  "Checkmate ends before any king capture can occur.",
  "Stalemate, bare kings, and fifty-move-style draw handling are covered for verified western rules.",
  "Promotion, castling, self-check rejection, terminal-state blocking, and bot legal validation are tested."
];

const ruleCompletionByVariant: Record<string, VariantRuleCompletion> = {
  classic: {
    status: "verified-playable",
    verifiedEdgeCases: verifiedChessEdgeCases,
    remainingGates: []
  },
  chess960: {
    status: "verified-playable",
    verifiedEdgeCases: [...verifiedChessEdgeCases, "Chess960 uses verified standard castling destinations after randomized setup."],
    remainingGates: []
  },
  xiangqi: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Generals stay inside the palace and may not face across an open file.",
      "Horse-leg, elephant-eye, river, cannon-screen, checkmate, and stalemate-loss behavior are covered.",
      "Royal capture is rejected; legal-move validation decides terminal positions."
    ],
    remainingGates: []
  },
  shogi: {
    status: "rules-gated",
    verifiedEdgeCases: ["Board setup, promotion zones, hands/drop intent, and legal-move scaffolding are present."],
    remainingGates: ["Nifu pawn-drop fixtures", "Dead-square drop fixtures", "Pawn-drop mate fixtures", "Impasse and repetition policy"]
  },
  janggi: {
    status: "rules-gated",
    verifiedEdgeCases: ["Palace board shape and xiangqi-family movement scaffold are present."],
    remainingGates: ["Native palace diagonals", "Janggi cannon screens", "Facing-general policy", "Pass/scoring tournament profile"]
  },
  makruk: {
    status: "rules-gated",
    verifiedEdgeCases: ["Makruk setup, no-castling flag, and promotion intent are present."],
    remainingGates: ["Native met/khon movement fixtures", "Makruk promotion fixtures", "Counting-rule draw fixtures"]
  },
  jungle: {
    status: "rules-gated",
    verifiedEdgeCases: [
      "Opposing animal ownership, board terrain, den/trap/river tiles, and native animal ranks are covered.",
      "Rat river entry, rat-elephant exception, trap weakening, lion/tiger river jumps, den-entry wins, and all-animal-capture wins have fixtures."
    ],
    remainingGates: ["No-progress/repetition policy", "Bot/review/persistence/E2E completion"]
  },
  antichess: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Mandatory captures are enforced across the whole side.",
      "The king is non-royal and capturable without ending the game by checkmate logic.",
      "Lose-all-pieces and no-legal-move wins are covered by terminal-state fixtures."
    ],
    remainingGates: []
  },
  horde: {
    status: "rules-gated",
    verifiedEdgeCases: ["Asymmetric horde setup, standard black-king safety intent, and horde-elimination win fixtures are present."],
    remainingGates: ["Asymmetric check/draw fixtures", "Promotion, timeout, and en-passant policy", "Bot/review/persistence/E2E completion"]
  },
  "king-of-the-hill": {
    status: "verified-playable",
    verifiedEdgeCases: [...verifiedChessEdgeCases, "A king reaching the center ends the game immediately as a variant objective."],
    remainingGates: []
  },
  "three-check": {
    status: "verified-playable",
    verifiedEdgeCases: [...verifiedChessEdgeCases, "The third delivered check ends the game before ordinary continuation."],
    remainingGates: []
  }
};

export function getVariantRuleSummary(key: string) {
  const variant = getVariant(key);
  const summary = variantRuleSummaries[variant.key];
  return {
    ...summary,
    completion: ruleCompletionByVariant[variant.key] ?? {
      status: "rules-gated",
      verifiedEdgeCases: [],
      remainingGates: ["Register a rule-completion matrix before exposing this game as playable."]
    }
  };
}

export function allVariantRuleSummaries() {
  return variantCatalog.map((variant) => getVariantRuleSummary(variant.key));
}
