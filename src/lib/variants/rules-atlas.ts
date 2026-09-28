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
    specialRules: ["Castling", "Promotion to queen, rook, bishop, or knight", "En passant", "Check and checkmate"],
    winConditions: ["Checkmate", "Timeout when the opponent has mating material", "Resignation"],
    drawConditions: ["Stalemate", "Insufficient material", "Repetition", "Fifty-move rule", "Mutual agreement"],
    illegalMoveNotes: ["A king may not move into check.", "A checked player must remove the check.", "Royal captures are never legal."]
  },
  chaturanga: {
    variantKey: "chaturanga",
    sourceLinks: [{ name: "Encyclopaedia Britannica chess origins overview", url: "https://www.britannica.com/topic/chess" }],
    numberedBasics: [
      "The minister moves one square diagonally and the elephant jumps exactly two squares diagonally.",
      "Chariots move like rooks, horses move like knights, and pawns move one square forward.",
      "Pawns promote to minister on the back rank; no castling, double pawn push, or en passant is used.",
      "Win by checkmate or by baring the opposing king."
    ],
    specialRules: ["Minister", "Elephant jump", "One-step pawns", "No castling", "Bare-king objective"],
    winConditions: ["Checkmate", "Bare the opposing king", "Timeout"],
    drawConditions: ["Mutual bare kings", "Threefold repetition (automatic)", "Fifty-move rule"],
    illegalMoveNotes: ["The elephant must land exactly two diagonal squares away.", "Pawns may not double-push.", "A player may not leave their king in check."]
  },
  chess960: {
    variantKey: "chess960",
    sourceLinks: [{ name: "FIDE Laws of Chess, Chess960 Guidelines", url: "https://rcc.fide.com/fide-laws-of-chess_fulltexthtml/" }],
    numberedBasics: [
      "Each new game starts from one of the 960 legal back ranks; Black mirrors White.",
      "Bishops start on opposite colors and the king starts between the rooks.",
      "Castling puts the king on the g- or c-file and the rook on the f- or d-file; both may already stand there, the squares they cross must be empty, and the king may not start in, pass through, or land in check.",
      "Checkmate, draw, and promotion rules match classic chess, including promotion to a rook, bishop, or knight."
    ],
    specialRules: ["Randomized legal start positions", "Chess960 castling", "Standard check and promotion", "Underpromotion"],
    winConditions: ["Checkmate", "Timeout with mating material", "Resignation"],
    drawConditions: ["Stalemate", "Insufficient material", "Repetition", "Fifty-move rule", "Mutual agreement"],
    illegalMoveNotes: ["Castling must obey check-through-check restrictions.", "Castling is lost once the king or that rook has moved.", "Royal captures are never legal."]
  },
  crazyhouse: {
    variantKey: "crazyhouse",
    sourceLinks: [{ name: "Lichess Crazyhouse rules", url: "https://lichess.org/variant/crazyhouse" }],
    numberedBasics: [
      "Normal chess movement, check, checkmate, promotion, and castling rules apply.",
      "Captured pieces enter the capturer's pocket and may be dropped back as that player's pieces.",
      "Pawn drops are not legal on the first or last rank.",
      "Promoted pawns return to the pocket as pawns when captured."
    ],
    specialRules: ["Piece pockets", "Drops", "Pawn drop rank limits", "Promoted-pawn demotion"],
    winConditions: ["Checkmate", "Timeout when the opponent has mating material", "Resignation"],
    drawConditions: ["Stalemate", "Threefold repetition (automatic)", "Fifty-move rule", "Mutual agreement"],
    illegalMoveNotes: ["Drops must be on empty squares.", "Pawns may not be dropped on the first or last rank.", "A player may not leave their king in check."]
  },
  shatranj: {
    variantKey: "shatranj",
    sourceLinks: [{ name: "Chess Variant Pages Shatranj", url: "https://www.chessvariants.com/historic.dir/shatranj.html" }],
    numberedBasics: [
      "The ferz moves one square diagonally and the alfil jumps exactly two squares diagonally.",
      "Pawns move one square forward, capture diagonally, and promote to ferz.",
      "There is no castling, double pawn push, or en passant.",
      "Win by checkmate, by stalemating the opponent, or by baring the opposing king unless its next move bares your king too."
    ],
    specialRules: ["Ferz", "Alfil jump", "One-step pawns", "No castling", "Bare-king objective"],
    winConditions: ["Checkmate", "Stalemate the opponent", "Bare the opposing king", "Timeout"],
    drawConditions: ["Mutual bare kings", "Threefold repetition (automatic)", "Fifty-move rule"],
    illegalMoveNotes: ["The alfil must land exactly two diagonal squares away.", "Pawns may not double-push.", "A player may not leave their king in check."]
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
    winConditions: ["Checkmate", "Stalemate against the side to move", "Opponent gives perpetual check through a threefold repetition", "Timeout"],
    drawConditions: ["Threefold repetition without perpetual check (automatic)", "Mutual agreement"],
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
      "Checkmate or leaving the opponent without a legal move wins; passing is not allowed."
    ],
    specialRules: ["Piece drops", "Promotion zone", "Nifu pawn restriction", "Pawn-drop mate restriction"],
    winConditions: ["Checkmate", "Opponent has no legal move", "Illegal move in strict competitive mode", "Resignation", "Timeout"],
    drawConditions: ["Repetition rules according to selected mode", "Impasse scoring in supported rules mode"],
    illegalMoveNotes: ["Do not drop a pawn on a file with an unpromoted friendly pawn.", "Do not drop a piece where it can never move.", "Do not leave your king in check."]
  },
  "mini-shogi": {
    variantKey: "mini-shogi",
    sourceLinks: [{ name: "Minishogi rules overview", url: "https://en.wikipedia.org/wiki/Minishogi" }],
    numberedBasics: [
      "Play Shogi on a 5x5 board with king, gold, silver, bishop, rook, and pawn per side.",
      "Captured pieces become pieces in hand and can be dropped back unpromoted.",
      "The promotion zone is only the farthest rank from each player.",
      "Checkmate or leaving the opponent without a legal move wins; illegal pawn drops and self-check restrictions still apply."
    ],
    specialRules: ["5x5 board", "Drops", "One-rank promotion zone", "Nifu pawn restriction", "Pawn-drop mate restriction"],
    winConditions: ["Checkmate", "Opponent has no legal move", "Resignation", "Timeout"],
    drawConditions: ["Repetition/no-progress according to selected room rules"],
    illegalMoveNotes: ["Do not drop a pawn on a file with an unpromoted friendly pawn.", "Do not drop pawns, lances, or knights where they can never move.", "Do not leave your king in check."]
  },
  janggi: {
    variantKey: "janggi",
    sourceLinks: [{ name: "PyChess Janggi reference", url: "https://www.pychess.org/variants/janggi" }],
    numberedBasics: [
      "Blue Cho moves first. Red Han receives 1.5 points when two passes trigger material scoring.",
      "Play on 9x10 intersections without a river. Generals start in palace centres. Choose one of four horse-and-elephant formations; in online rooms Han confirms first, then Cho.",
      "Palace diagonals extend some moves. Cannons need a non-cannon screen and cannot capture another cannon.",
      "Checkmate wins. In this app's casual profile, leaving a bikjang challenge unanswered draws; two passes compare material points."
    ],
    specialRules: ["Palace diagonals", "Cannon screens", "No river", "Facing generals", "Optional pass in rules mode"],
    winConditions: ["Checkmate", "Timeout", "Higher material score after consecutive passes or a threefold repetition", "Opponent gives perpetual check through a threefold repetition"],
    drawConditions: ["Unanswered bikjang in this casual profile", "Mutual agreement"],
    illegalMoveNotes: ["A cannon cannot screen or capture another cannon.", "Passing is unavailable in check.", "A player may not remain in check."]
  },
  "ouk-chaktrang": {
    variantKey: "ouk-chaktrang",
    sourceLinks: [{ name: "PyChess Ouk Chaktrang digital rules", url: "https://www.pychess.org/variants/cambodian" }, { name: "Cambodia federation: 2022 championship regulations, Article 5", url: "https://docs.google.com/document/d/1adppJ66vonM27UYwC-KyldXl7oZ_5Pb0/edit" }],
    numberedBasics: ["Khon (king) starts to each player’s left of Neang (queen).", "Trey pawns start on the third rank and promote to Neang on the sixth.", "Khon may leap to the second rank once; Neang may leap two squares forward once. Neither leap captures.", "Checkmate wins unless the winner still claims a board count. Endgame counting follows the published PyChess digital profile."],
    specialRules: ["Khon opening leap", "Neang opening leap", "Rook alignment permanently removes Khon’s leap", "Sixth-rank promotion", "With at most three pieces, claim a board count from 1 to 64 on your turn. Stop it to play for a win; restarting begins at 1.", "A bare king with no unpromoted pawns anywhere may choose a piece count. Start at the total pieces plus one; use the shortest material limit: two boats 8, one boat 16, two generals 22, two horses 32, one general 44, otherwise 64.", "Only the claimant’s moves count. A piece count stays fixed after captures and cannot be restarted. A bare king may replace a board count with a piece count."],
    winConditions: ["Checkmate", "Resignation"],
    drawConditions: ["Stalemate or only two kings", "Counting limit reached", "Chasing player accepts a board-count draw", "Board-count claimant mates without first stopping their count", "Mutual agreement"],
    illegalMoveNotes: ["No castling, pawn double-step, or en passant.", "Khon cannot leap while checked or after an opposing rook aligns with its rank or file."]
  },
  makruk: {
    variantKey: "makruk",
    sourceLinks: [{ name: "PyChess Makruk honor-count profile", url: "https://www.pychess.org/variants/makruk" }, { name: "GNU XBoard Makruk rules", url: "https://www.gnu.org/software/xboard/whats_new/rules/Makruk.html" }],
    numberedBasics: [
      "In Thai Makruk, Khun starts to each player's left of Met: White's king is on d1 and Black's on e8.",
      "Bia pawns start on the third rank, move one step, and promote to Met movement on the sixth rank.",
      "Met steps one square diagonally; Khon steps diagonally or one square forward. There is no castling or opening leap.",
      "Checkmate wins unless the mating player still claims board honor. New games use the published PyChess honor-count profile; earlier saves keep their legacy counter."
    ],
    specialRules: ["No castling or opening leap", "Sixth-rank promotion", "With no unpromoted pawns left, claim board honor on your turn: count your moves from 1 to 64. Stop before playing for a win; a new claim restarts at 1. The opponent may accept a draw.", "A bare king with no unpromoted pawns anywhere automatically starts piece honor, replacing board honor. Start at all remaining pieces plus one; freeze the shortest limit: two rooks 8, one rook 16, two Khon 22, two horses 32, one Khon 44, otherwise 64.", "Only the escaping player's moves count. The first announces the starting number; exceeding the limit draws. Captures never reset a piece count."],
    winConditions: ["Checkmate", "Timeout", "Resignation"],
    drawConditions: ["Honor count exceeds its limit", "Chaser accepts a board-count draw", "Board-count claimant gives mate without stopping", "Stalemate or only two kings"],
    illegalMoveNotes: ["No castling is allowed.", "Promotion follows Makruk piece rules.", "A king may not stay in check."]
  },
  jungle: {
    variantKey: "jungle",
    sourceLinks: [{ name: "Yellow Mountain Imports Dou Shou Qi rules", url: "https://www.ymimports.com/pages/how-to-play-jungle" }],
    numberedBasics: [
      "Rank 1–8: Rat, Cat, Wolf, Dog, Leopard, Tiger, Lion, Elephant. Capture equal or lower ranks.",
      "Only rats swim. Lions and tigers jump rivers unless a rat blocks the path.",
      "Three traps surround each den. An enemy in your trap can be captured by any of your animals.",
      "No check/checkmate. Win by entering the opponent den or eliminating all opponent animals."
    ],
    specialRules: ["Animal ranks", "River movement", "Rat exceptions", "Trap weakening", "Den objective"],
    winConditions: ["Enter the opponent den", "Capture all opposing animals"],
    drawConditions: ["No legal move is a draw in new games", "Mutual agreement in friend rooms; no automatic repetition or no-progress draw"],
    illegalMoveNotes: ["Most animals may not enter river squares.", "Pieces may not enter their own den.", "Rats cannot capture across the water–land boundary.", "Elephants cannot capture rats, except enemy rats weakened in your traps.", "White moves first in AllChess. Unversioned saved games retain their original rules."]
  },
  "english-draughts": {
    variantKey: "english-draughts",
    sourceLinks: [{ name: "English Draughts Association rules", url: "https://www.english-draughts.org/rules" }],
    numberedBasics: [
      "Men move one square diagonally forward on the dark squares.",
      "Captures are compulsory, but any capture may be chosen, not only the longest; a jumping piece must continue while more jumps are available.",
      "Men become kings on the far row, and a jump that reaches it ends the move; kings move and jump one square diagonally in any direction.",
      "Win by capturing all opposing checkers or leaving the opponent with no legal move."
    ],
    specialRules: ["Dark-square movement", "Compulsory captures with free choice", "Multi-jump continuation", "Kinging"],
    winConditions: ["Capture all opposing checkers", "Block every opposing legal move"],
    drawConditions: ["Repetition or no-progress policy in selected room rules", "Mutual agreement"],
    illegalMoveNotes: ["A quiet move is illegal when any friendly checker can jump.", "A jump must land on the empty square beyond the captured checker.", "Only the same checker may move during a forced multi-jump continuation."]
  },
  "international-draughts": {
    variantKey: "international-draughts",
    sourceLinks: [{ name: "FMJD rules", url: "https://www.fmjd.org/downloads/Annexes/Annex%201%20Rules%20of%20the%20Game.pdf" }],
    numberedBasics: [
      "Play on a 10x10 board with twenty men per side on the dark squares.",
      "Men move one square diagonally forward but may capture diagonally forward or backward.",
      "Captures are compulsory, the longest capture line is required, and kings are flying kings. Captured pieces are removed when the move ends.",
      "Win by capturing all opposing checkers or leaving the opponent with no legal move."
    ],
    specialRules: ["10x10 board", "Backward man captures", "Maximum-capture rule", "Flying kings", "Kinging"],
    winConditions: ["Capture all opposing checkers", "Block every opposing legal move"],
    drawConditions: ["Repetition or no-progress policy in selected room rules", "Mutual agreement"],
    illegalMoveNotes: ["A shorter capture line is illegal when a longer one exists.", "Flying kings must jump exactly one opposing checker and land on an empty square beyond it.", "A captured checker cannot be jumped twice in one move.", "A man passing the far row during a capture is crowned only if the capture ends there.", "A quiet move is illegal when any capture exists."]
  },
  "turkish-draughts": {
    variantKey: "turkish-draughts",
    sourceLinks: [{ name: "MindSports Turkish Draughts rules", url: "https://mindsports.nl/index.php/the-pit/592-turkish-draughts" }],
    numberedBasics: [
      "Play on an 8x8 board with two full rows of men per side.",
      "Men move and capture orthogonally, one square forward or sideways, never backward.",
      "Captures are compulsory, the longest capture line is required, and kings fly orthogonally. Each captured piece is removed at once.",
      "Win by capturing all opposing checkers or leaving the opponent with no legal move."
    ],
    specialRules: ["Orthogonal movement", "Sideways men", "Orthogonal maximum-capture rule", "Flying kings", "Kinging"],
    winConditions: ["Capture all opposing checkers", "Block every opposing legal move"],
    drawConditions: ["Repetition or no-progress policy in selected room rules", "Mutual agreement"],
    illegalMoveNotes: ["A man may not move or capture backward.", "A shorter capture line is illegal when a longer one exists.", "Flying kings must jump exactly one opposing checker and land on an empty square beyond it.", "A king may not reverse direction between two jumps."]
  },
  konane: {
    variantKey: "konane",
    sourceLinks: [{ name: "National Park Service Kōnane rules (this profile)", url: "https://www.nps.gov/thingstodo/play-konane.htm" }, { name: "NPS illustrated rules", url: "https://www.nps.gov/puho/learn/historyculture/upload/Konane-Rules-508.pdf" }],
    numberedBasics: [
      "This NPS profile uses an 8x8 papamū filled with alternating black and white stones.",
      "Black removes any own stone, then White removes any own stone; the removals need not be adjacent.",
      "Then jump over opposing stones into empty spaces along one straight orthogonal line. Choose a nearer landing to stop or a farther landing to capture more.",
      "Win by leaving the opponent with no legal jump capture."
    ],
    specialRules: ["Opening removals", "Orthogonal jumps", "Optional straight jump sequences", "NPS rules profile", "No legal jump loses"],
    winConditions: ["Leave the opponent with no legal jump", "Capture until the opponent is immobilized"],
    drawConditions: ["Mutual agreement or selected room no-progress policy"],
    illegalMoveNotes: ["Diagonal jumps are illegal.", "A stone may not slide without jumping after the opening.", "A jump sequence cannot turn a corner, cross a gap or jump a friendly stone.", "Older saved games retain their original adjacent second removal and forced continuation rules."]
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
    specialRules: ["Mandatory captures", "No check", "King is non-royal", "Pawns may promote to a king as well as a queen, rook, bishop, or knight"],
    winConditions: ["Lose all pieces", "Have no legal move under antichess rules"],
    drawConditions: ["Threefold repetition (automatic)"],
    illegalMoveNotes: ["A non-capture is illegal when a capture exists.", "Check restrictions do not apply."]
  },
  horde: {
    variantKey: "horde",
    sourceLinks: [{ name: "Lichess horde rules", url: "https://lichess.org/variant/horde" }],
    numberedBasics: [
      "White plays the Lichess 36-pawn horde; black has a normal army.",
      "White wins by checkmating black.",
      "Black wins by eliminating the horde.",
      "Draw/check rules follow the supported horde ruleset."
    ],
    specialRules: ["Asymmetric armies", "First-rank horde pawns may advance two squares, with no en passant", "Horde elimination objective", "Standard black king safety"],
    winConditions: ["White checkmates black", "Black captures all horde pieces", "Timeout"],
    drawConditions: ["Stalemate", "Threefold repetition (automatic)", "Fifty-move rule"],
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
    drawConditions: ["Standard chess draw rules unless objective is achieved first", "Bare kings are not a draw: either king can still reach the center"],
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
  },
  "racing-kings": {
    variantKey: "racing-kings",
    sourceLinks: [{ name: "Lichess Racing Kings rules", url: "https://lichess.org/variant/racingKings" }],
    numberedBasics: [
      "Each player has a standard set of pieces with no pawns.",
      "Pieces move as in chess, but giving check is illegal.",
      "The first king to reach the eighth rank wins.",
      "If White reaches first, Black may immediately reach the eighth rank to draw."
    ],
    specialRules: ["No pawns", "Checks are forbidden", "Race-to-eighth objective", "Black reply draw after White reaches"],
    winConditions: ["King reaches the eighth rank first", "White reaches and Black fails to answer on the next move"],
    drawConditions: ["Black reaches the eighth rank immediately after White reaches first", "Stalemate", "Fifty-move rule", "Threefold repetition (automatic)"],
    illegalMoveNotes: ["A move may not give check.", "A king may not move into check.", "Royal captures are never legal."]
  }
};

const verifiedChessEdgeCases = [
  "Royal pieces cannot be captured in check-based games.",
  "Checkmate ends before any king capture can occur.",
  "Threefold repetition draws automatically; a position repeats only with the same side to move, castling rights, and en passant option.",
  "Stalemate, bare kings, and fifty-move-style draw handling are covered for verified western rules.",
  "Promotion (including underpromotion), castling, self-check rejection, terminal-state blocking, and bot legal validation are tested."
];
const orthodoxMaterialEdgeCase = "King and one minor piece against king, or bishops all on one square colour, is drawn at once, and a flag against a side that cannot mate is a draw.";

const ruleCompletionByVariant: Record<string, VariantRuleCompletion> = {
  "ouk-chaktrang": {
    status: "rules-gated",
    verifiedEdgeCases: ["Native setup, first-move rights, non-capturing leaps, rook alignment and sixth-rank promotion.", "Explicit board/piece counting, fixed limits, claimant-only moves, stop/restart, accepted draws, counter-mate draws, and bare-king priority."],
    remainingGates: ["The digital counting profile is implemented; referee-dependent tournament interpretations still require separate verification.", "Online competitive verification and calibrated bot benchmarks are pending."]
  },
  classic: {
    status: "verified-playable",
    verifiedEdgeCases: [...verifiedChessEdgeCases, orthodoxMaterialEdgeCase],
    remainingGates: []
  },
  chaturanga: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Minister one-step diagonal movement and elephant two-square jump movement are covered.",
      "Pawns move one step, cannot double-push, and promote to minister on the back rank.",
      "The bare-king objective ends the game when the opponent has only a royal piece left.",
      "No castling is exposed for the historical ruleset and bot legal validation uses the native moves."
    ],
    remainingGates: []
  },
  chess960: {
    status: "verified-playable",
    verifiedEdgeCases: [
      ...verifiedChessEdgeCases,
      orthodoxMaterialEdgeCase,
      "All 960 back ranks are generated deterministically from the game id and recorded with the game; older fixed-setup saves still replay.",
      "Chess960 castling is tested on both wings, including kings or rooks already on their destination squares, blocked paths, and attacked squares."
    ],
    remainingGates: []
  },
  crazyhouse: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Captured pieces enter the mover pocket and can be dropped back as friendly unpromoted pieces.",
      "Pawn drops reject the first and last rank while allowing middle-rank empty squares.",
      "Drop moves are checked against king safety and bot legal validation before application.",
      "Promoted captured pawns demote back to pawns in hand."
    ],
    remainingGates: []
  },
  shatranj: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Ferz one-step diagonal movement and alfil two-square jump movement are covered.",
      "Pawns move one step, cannot double-push, and promote to ferz on the back rank.",
      "The bare-king objective wins once the bared king has no reply that bares the mover too; baring back draws.",
      "Stalemating the opponent wins, and new games start both shahs on the e-file; older games keep their original opening layout.",
      "No castling is exposed for the historical ruleset and bot legal validation uses the native moves."
    ],
    remainingGates: []
  },
  xiangqi: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Generals stay inside the palace and may not face across an open file.",
      "Horse-leg, elephant-eye, river, cannon-screen, checkmate, and stalemate-loss behavior are covered.",
      "Royal capture is rejected; legal-move validation decides terminal positions.",
      "Threefold repetition draws, and a side that checked on every move since the position first appeared loses instead."
    ],
    remainingGates: ["WXF perpetual chasing is not adjudicated; only perpetual check and plain repetition end the game automatically."]
  },
  shogi: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Board setup, promotion zones, native Shogi movement, and hand/drop intent are present.",
      "Nifu pawn drops and non-movable pawn/lance/knight drops have fixtures.",
      "Captured Shogi pieces are demoted into the capturer hand and can be dropped back onto legal empty squares.",
      "Pawn-drop mate is rejected while answerable checking pawn drops remain legal.",
      "Fourfold repetition, perpetual-check loss, and impasse material adjudication have fixtures."
    ],
    remainingGates: []
  },
  "mini-shogi": {
    status: "verified-playable",
    verifiedEdgeCases: [
      "The 5x5 reduced setup is registered with one pawn and five back-rank pieces per side.",
      "Drops, nifu, dead-drop restrictions, and pawn-drop mate validation reuse the verified Shogi path.",
      "The one-rank promotion zone is covered for both sides.",
      "On a fourfold repetition, the side that checked on every move of the cycle loses, as in Shogi."
    ],
    remainingGates: ["Other fourfold repetitions are drawn as in Shogi; the cited Minishogi rules score them as a loss for sente, who moved first."]
  },
  janggi: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Palace board shape, native palace diagonals, soldier sideways movement, long elephant paths, and Janggi cannon screen restrictions have fixtures.",
      "Cannons require a non-cannon screen, cannot capture cannons, and can use palace diagonal lines.",
      "Facing generals use bikjang handling: the next player must resolve the open file or the game is drawn.",
      "Pass is legal outside check, consecutive passes trigger material scoring, and bikjang pass keeps the draw policy.",
      "A threefold repetition is decided by material points, unless one side checked on every move since the position first appeared; that side loses.",
      "A legal cache-first Janggi bot seed, native review context, D1 persistence, and play-route smoke coverage are verified."
    ],
    remainingGates: []
  },
  makruk: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Makruk setup uses one royal king and one Met per side with no castling.",
      "Native Met, Khon, knight, rook, king, and pawn movement have fixtures.",
      "Pawns do not double-push or en-passant and promote to Met on the sixth rank.",
      "Versioned honor counting covers optional board claims, automatic bare-king transition, fixed limits, escaping-player moves, and count 9 against two rooks. Legacy saves retain their earlier counter.",
      "Count-aware bot preparation, saved timelines, three endgame exercises, and authoritative friend-room claims have fixtures."
    ],
    remainingGates: ["Rated matchmaking needs verified accounts and rating settlement. Casual Quick Match uses authoritative rooms with honor-count actions.", "Referee-dependent tournament interpretations require separate verification from the published digital profile."]
  },
  jungle: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Opposing animal ownership, board terrain, den/trap/river tiles, and native animal ranks are covered.",
      "Rat river entry, rat-elephant exception, trap weakening, lion/tiger river jumps, den-entry wins, all-animal-capture wins, bot validation, and persistence routing have fixtures."
    ],
    remainingGates: []
  },
  "english-draughts": {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Dark-square 8x8 setup and forward man movement are covered.",
      "Compulsory captures suppress quiet moves across the whole side, with free choice among captures.",
      "Jump captures remove the midpoint checker and Multi-jump continuation locks the turn to the same checker.",
      "Kinging and no-piece/no-legal-move wins are covered by runtime fixtures."
    ],
    remainingGates: []
  },
  "international-draughts": {
    status: "verified-playable",
    verifiedEdgeCases: [
      "10x10 dark-square setup and forward quiet movement are covered.",
      "Backward man captures and flying-king captures, which must land beyond the jumped checker, are covered.",
      "Maximum-capture filtering rejects shorter capture lines when longer lines exist; captured checkers cannot be jumped twice and a man is crowned only where its capture ends.",
      "Multi-jump continuation, kinging, and no-piece/no-legal-move wins reuse the verified draughts runtime path."
    ],
    remainingGates: []
  },
  "turkish-draughts": {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Two-row 8x8 setup and orthogonal forward/sideways man movement are covered.",
      "Backward moves and backward captures by men are rejected; kings cannot reverse direction between jumps and captured pieces are removed at once.",
      "Orthogonal maximum-capture filtering rejects shorter capture lines when longer lines exist.",
      "Flying kings, multi-jump continuation, kinging, and no-piece/no-legal-move wins reuse the verified draughts runtime path."
    ],
    remainingGates: []
  },
  konane: {
    status: "verified-playable",
    verifiedEdgeCases: [
      "Opening removals use Black first and unrestricted own-stone choices in the NPS profile; legacy saves keep White first and an adjacent second removal.",
      "Straight orthogonal jump sequences offer every landing prefix and remove all jumped enemies in one move.",
      "The NPS profile permits stopping after any jump and rejects corners, gaps and friendly blockers; legacy forced continuations remain compatible.",
      "No-legal-jump terminal states resolve as wins for the mover."
    ],
    remainingGates: []
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
    status: "verified-playable",
    verifiedEdgeCases: [
      "The Lichess horde setup (36 white pawns) faces black's standard royal army, and first-rank pawns double-step without an en passant right.",
      "White checkmate, black horde-elimination, promotion, no-insufficient-material shortcut, and legal bot validation are tested."
    ],
    remainingGates: []
  },
  "king-of-the-hill": {
    status: "verified-playable",
    verifiedEdgeCases: [
      ...verifiedChessEdgeCases.filter((note) => !note.includes("bare kings")),
      "Stalemate and fifty-move draws apply, but bare kings play on because either king can still reach the center.",
      "A king reaching the center ends the game immediately as a variant objective."
    ],
    remainingGates: []
  },
  "three-check": {
    status: "verified-playable",
    verifiedEdgeCases: [...verifiedChessEdgeCases, "The third delivered check ends the game before ordinary continuation.", "A lone minor piece can still give checks, so only a bare king lacks winning material, including on time."],
    remainingGates: []
  },
  "racing-kings": {
    status: "verified-playable",
    verifiedEdgeCases: [
      "The no-pawn shared-side setup is registered.",
      "Checks are forbidden, including discovered line checks.",
      "White's eighth-rank arrival gives Black one reply to draw; Black reaching first wins immediately.",
      "White wins at once when Black cannot reach the eighth rank in reply; stalemate and the fifty-move rule draw."
    ],
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

export function findVariantRuleCompletion(key: string) {
  try {
    return getVariantRuleSummary(key).completion;
  } catch {
    return null;
  }
}

export function allVariantRuleSummaries() {
  return variantCatalog.map((variant) => getVariantRuleSummary(variant.key));
}
