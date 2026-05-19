import { getVariantRuleSummary } from "@/lib/rules-atlas";
import { variantCatalog, type VariantDefinition } from "@/lib/variants";

import type { BoardGeometry, CatalogStats, GameCatalogEntry, GameFamilyKey, LeaderboardScope, PiecePresentationPack, PlayabilityStatus, PlayableGameVerification } from "./types";

export type {
  BoardGeometry,
  BotBenchmarkRun,
  BotEngineAdapter,
  CatalogStats,
  GameCatalogEntry,
  GameFamilyKey,
  GameNamePack,
  LeaderboardScope,
  PiecePresentationPack,
  PlayableGameVerification,
  PlayabilityStatus,
  RulesEngineAdapter
} from "./types";

export const gameFamilies: Array<{ key: GameFamilyKey; label: string; description: string }> = [
  { key: "chess-family", label: "Chess family", description: "Chaturanga descendants, western chess variants, and royal objective games." },
  { key: "asian-chess", label: "Asian chess systems", description: "Shogi, Xiangqi, Janggi, Makruk, Jungle, and regional relatives." },
  { key: "draughts", label: "Draughts and checkers", description: "Jump-capture games with men, kings, and compulsory capture variants." },
  { key: "mancala", label: "Mancala", description: "Sowing and capture games with pits, seeds, and stores." },
  { key: "go-family", label: "Go, Gomoku, and territory", description: "Stone-placement games focused on territory, connections, and patterns." },
  { key: "tables", label: "Tables and backgammon", description: "Race, block, hit, and bear-off games with dice and points." },
  { key: "tafl", label: "Tafl games", description: "Asymmetric escape games with a king, defenders, and attackers." },
  { key: "race", label: "Race games", description: "Cross, spiral, and irregular-path games where pieces race home." },
  { key: "mill", label: "Mill games", description: "Placement and movement games built around making rows of three." },
  { key: "regional", label: "Regional classics", description: "Cultural board games that need dedicated rules and presentation packs." }
];

const playableFamilyByVariant: Record<VariantDefinition["family"], GameFamilyKey> = {
  western: "chess-family",
  "east-asian": "asian-chess",
  "southeast-asian": "asian-chess",
  abstract: "asian-chess"
};

const presentationByVariant: Record<string, PiecePresentationPack> = {
  classic: "staunton-svg",
  chess960: "staunton-svg",
  antichess: "staunton-svg",
  horde: "staunton-svg",
  "king-of-the-hill": "staunton-svg",
  "three-check": "staunton-svg",
  xiangqi: "xiangqi-disk",
  shogi: "shogi-koma",
  janggi: "xiangqi-disk",
  makruk: "makruk-carved",
  jungle: "jungle-animals"
};

const localizedPlayableNames: Record<string, GameCatalogEntry["name"]> = {
  classic: { english: "Classic Chess", short: "Chess" },
  chess960: { english: "Chess960", romanization: "Fischer Random" },
  xiangqi: { english: "Xiangqi", native: "象棋", romanization: "Xiàngqí" },
  shogi: { english: "Shogi", native: "将棋", romanization: "Shōgi" },
  janggi: { english: "Janggi", native: "장기", romanization: "Janggi" },
  makruk: { english: "Makruk", native: "หมากรุก", romanization: "Makruk" },
  jungle: { english: "Jungle", native: "鬥獸棋", romanization: "Dòu Shòu Qí", short: "Jungle / Dou Shou Qi" },
  antichess: { english: "Antichess" },
  horde: { english: "Horde" },
  "king-of-the-hill": { english: "King of the Hill" },
  "three-check": { english: "Three-check" }
};

const completeVerification: PlayableGameVerification = {
  rulesComplete: true,
  botComplete: true,
  reviewComplete: true,
  persistenceComplete: true,
  e2eComplete: true,
  knownGaps: []
};

function incompleteVerification(knownGaps: string[]): PlayableGameVerification {
  return {
    rulesComplete: false,
    botComplete: false,
    reviewComplete: false,
    persistenceComplete: false,
    e2eComplete: false,
    knownGaps
  };
}

function isVerificationComplete(verification: PlayableGameVerification) {
  return (
    verification.rulesComplete &&
    verification.botComplete &&
    verification.reviewComplete &&
    verification.persistenceComplete &&
    verification.e2eComplete &&
    verification.knownGaps.length === 0
  );
}

function boardFromVariant(variant: VariantDefinition): BoardGeometry {
  return variant.board.coordinates === "orthodox"
    ? { kind: "square-grid", rows: variant.board.rows, cols: variant.board.cols, description: `${variant.board.rows}x${variant.board.cols} square grid.` }
    : { kind: "intersection-grid", rows: variant.board.rows, cols: variant.board.cols, description: `${variant.board.rows}x${variant.board.cols} intersection board.` };
}

function playableEntryFromVariant(variant: VariantDefinition): GameCatalogEntry {
  const rules = getVariantRuleSummary(variant.key);
  const verification = getPlayableGameVerification(variant.key);
  return {
    id: variant.key,
    variantKey: variant.key,
    name: localizedPlayableNames[variant.key] ?? { english: variant.key },
    aliases: [...variant.aliases, variant.key],
    family: playableFamilyByVariant[variant.family],
    region: playableRegion(variant.key),
    board: boardFromVariant(variant),
    piecePresentation: presentationByVariant[variant.key] ?? "staunton-svg",
    playability: isVerificationComplete(verification) ? "playable" : "learn",
    rulesAdapter: variant.rulesAdapter,
    botAdapter: variant.engineProtocol === "internal" ? "internal-search" : "fairy-stockfish",
    learningStatus: "ready",
    ruleSourceLinks: rules.sourceLinks,
    shortRules: rules.numberedBasics,
    winConditions: rules.winConditions,
    reviewFocus: ["Legal moves", "Terminal result", "Bot move validation", ...rules.specialRules.slice(0, 3)],
    recommendations: relatedFor(variant.key),
    verification
  };
}

function playableRegion(key: string) {
  if (["xiangqi", "shogi", "janggi", "jungle"].includes(key)) return ["East Asia"];
  if (key === "makruk") return ["Southeast Asia", "Thailand"];
  return ["Global"];
}

function relatedFor(key: string) {
  const related: Record<string, string[]> = {
    classic: ["chess960", "three-check", "king-of-the-hill"],
    chess960: ["classic", "horde", "antichess"],
    xiangqi: ["janggi", "jungle", "minixiangqi"],
    shogi: ["mini-shogi", "chu-shogi", "crazyhouse"],
    janggi: ["xiangqi", "shogi", "jungle"],
    makruk: ["sittuyin", "ouk-chaktrang", "asean-chess"],
    jungle: ["xiangqi", "janggi", "bagha-chal"]
  };
  return related[key] ?? ["classic", "chess960", "go-19x19"];
}

function catalogEntry(input: Omit<GameCatalogEntry, "aliases" | "learningStatus" | "reviewFocus" | "recommendations"> & Partial<Pick<GameCatalogEntry, "aliases" | "learningStatus" | "reviewFocus" | "recommendations">>): GameCatalogEntry {
  return {
    learningStatus: input.playability === "coming-soon" ? "researching" : "draft",
    reviewFocus: ["Rules explanation", "Result reason", "Replay milestones"],
    recommendations: [],
    ...input,
    aliases: [...new Set([input.id, ...(input.aliases ?? [])])]
  };
}

const learningCatalogEntries: GameCatalogEntry[] = [
  catalogEntry({
    id: "chaturanga",
    name: { english: "Chaturanga", native: "चतुरङ्ग", romanization: "Chaturanga" },
    aliases: ["ancient-indian-chess"],
    family: "chess-family",
    region: ["India", "South Asia"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "Historic 8x8 ancestor of the chess family." },
    piecePresentation: "makruk-carved",
    playability: "learn",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Encyclopaedia Britannica overview", url: "https://www.britannica.com/topic/chess" }],
    shortRules: ["Historic four-division army game.", "Rules varied by source and period.", "AllChess will keep it learning-only until one rules profile is locked."],
    winConditions: ["Rules profile pending"]
  }),
  catalogEntry({
    id: "shatranj",
    name: { english: "Shatranj", native: "شطرنج", romanization: "Shatranj" },
    aliases: ["persian-chess"],
    family: "chess-family",
    region: ["Persia", "Middle East"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "8x8 board with ferz and alfil movement." },
    piecePresentation: "makruk-carved",
    playability: "learn",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "heuristic",
    ruleSourceLinks: [{ name: "Chess Variant Pages Shatranj", url: "https://www.chessvariants.com/historic.dir/shatranj.html" }],
    shortRules: ["The ferz moves one square diagonally.", "The alfil jumps two squares diagonally.", "Mate, bare king, and stalemate policies depend on the selected profile."],
    winConditions: ["Checkmate", "Bare king in selected rules profiles"]
  }),
  catalogEntry({
    id: "atomic",
    name: { english: "Atomic Chess" },
    aliases: ["atomic-chess"],
    family: "chess-family",
    region: ["Global"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "Standard chess board with explosion captures." },
    piecePresentation: "staunton-svg",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "fairy-stockfish",
    ruleSourceLinks: [{ name: "Lichess Atomic rules", url: "https://lichess.org/variant/atomic" }],
    shortRules: ["Captures explode adjacent non-pawn pieces.", "Kings may be affected by explosions.", "Checkmate and explosion objectives need variant-specific validation."],
    winConditions: ["Explode the opponent king", "Checkmate in supported rules profile"]
  }),
  catalogEntry({
    id: "crazyhouse",
    name: { english: "Crazyhouse" },
    aliases: ["drop-chess"],
    family: "chess-family",
    region: ["Global"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "Standard chess board with captured pieces dropped back as your own." },
    piecePresentation: "staunton-svg",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "fairy-stockfish",
    ruleSourceLinks: [{ name: "Lichess Crazyhouse rules", url: "https://lichess.org/variant/crazyhouse" }],
    shortRules: ["Captured pieces enter your pocket.", "Pocket pieces may be dropped on legal empty squares.", "Checkmate remains the main objective."],
    winConditions: ["Checkmate", "Timeout with mating material"]
  }),
  catalogEntry({
    id: "bughouse",
    name: { english: "Bughouse" },
    aliases: ["siamese-chess"],
    family: "chess-family",
    region: ["Global"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "Two synchronized 8x8 boards for partner chess." },
    piecePresentation: "staunton-svg",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "fairy-stockfish",
    ruleSourceLinks: [{ name: "US Chess bughouse overview", url: "https://new.uschess.org/news/bughouse-chess" }],
    shortRules: ["Two players form a team.", "Captured pieces pass to the teammate.", "Team result follows the first decisive board."],
    winConditions: ["Team checkmate", "Timeout policy by room profile"]
  }),
  catalogEntry({
    id: "racing-kings",
    name: { english: "Racing Kings" },
    family: "chess-family",
    region: ["Global"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "Race-oriented chess setup on an 8x8 board." },
    piecePresentation: "staunton-svg",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "fairy-stockfish",
    ruleSourceLinks: [{ name: "Lichess Racing Kings rules", url: "https://lichess.org/variant/racingKings" }],
    shortRules: ["Both kings race to the eighth rank.", "Giving check is illegal.", "The first legal king arrival wins."],
    winConditions: ["King reaches the target rank first"]
  }),
  catalogEntry({
    id: "four-player-chess",
    name: { english: "Four-player Chess" },
    aliases: ["4-player-chess"],
    family: "chess-family",
    region: ["Global"],
    board: { kind: "square-grid", rows: 14, cols: 14, description: "Extended four-arm chess board." },
    piecePresentation: "staunton-svg",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "heuristic",
    ruleSourceLinks: [{ name: "Chess.com four-player chess guide", url: "https://www.chess.com/terms/4-player-chess" }],
    shortRules: ["Four armies start on an extended board.", "Turn order and teams depend on room mode.", "Scoring and checkmate policies must be room-explicit."],
    winConditions: ["Last player/team standing", "Points mode in selected rooms"]
  }),
  catalogEntry({
    id: "mini-shogi",
    name: { english: "Mini Shogi", native: "五五将棋", romanization: "Gogo Shōgi" },
    family: "asian-chess",
    region: ["Japan"],
    board: { kind: "square-grid", rows: 5, cols: 5, description: "Compact 5x5 shogi with drops." },
    piecePresentation: "shogi-koma",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "Shogi Harbour Mini Shogi rules", url: "https://shogi.cz/en/varianty/mini-shogi" }],
    shortRules: ["Uses a 5x5 board.", "Captured pieces can be dropped.", "Promotion and checkmate follow the selected mini-shogi profile."],
    winConditions: ["Checkmate", "Illegal move loss in strict profile"]
  }),
  catalogEntry({
    id: "chu-shogi",
    name: { english: "Chu Shogi", native: "中将棋", romanization: "Chū Shōgi" },
    family: "asian-chess",
    region: ["Japan"],
    board: { kind: "square-grid", rows: 12, cols: 12, description: "Large 12x12 shogi-family board." },
    piecePresentation: "shogi-koma",
    playability: "learn",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Chu Shogi rules by the Chu Shogi Association", url: "https://www.chushogi-renmei.com/" }],
    shortRules: ["Large-board shogi family game.", "Many piece types have unique movement.", "AllChess keeps it learning-only until the rules adapter is complete."],
    winConditions: ["Capture/checkmate the royal piece according to rules profile"]
  }),
  catalogEntry({
    id: "banqi",
    name: { english: "Banqi", native: "半棋", romanization: "Bànqí" },
    aliases: ["chinese-dark-chess"],
    family: "asian-chess",
    region: ["China", "Taiwan"],
    board: { kind: "square-grid", rows: 4, cols: 8, description: "Face-down pieces on a 4x8 grid." },
    piecePresentation: "xiangqi-disk",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "mcts",
    ruleSourceLinks: [{ name: "Chess Variant Pages Banqi", url: "https://www.chessvariants.com/xiangqi.dir/banqi.html" }],
    shortRules: ["Pieces begin face-down.", "Moves and captures depend on revealed ranks.", "Hidden-information review needs probability-aware explanations."],
    winConditions: ["Capture all opposing pieces or force no moves under profile"]
  }),
  catalogEntry({
    id: "minixiangqi",
    name: { english: "Mini Xiangqi", native: "迷你象棋", romanization: "Mínǐ Xiàngqí" },
    family: "asian-chess",
    region: ["China"],
    board: { kind: "intersection-grid", rows: 7, cols: 7, description: "Small xiangqi-style intersection board." },
    piecePresentation: "xiangqi-disk",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "Chess Variant Pages Minixiangqi", url: "https://www.chessvariants.com/xiangqi.dir/minixiangqi.html" }],
    shortRules: ["Streamlined xiangqi-family movement.", "No river, advisors, or elephants in common profiles.", "General safety remains core."],
    winConditions: ["Checkmate", "Stalemate by profile"]
  }),
  catalogEntry({
    id: "sittuyin",
    name: { english: "Sittuyin", native: "စစ်တုရင်", romanization: "Sittuyin" },
    aliases: ["burmese-chess"],
    family: "asian-chess",
    region: ["Myanmar"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "8x8 board with diagonal setup lines." },
    piecePresentation: "makruk-carved",
    playability: "learn",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Chess Variant Pages Sittuyin", url: "https://www.chessvariants.com/oriental.dir/burmese.html" }],
    shortRules: ["Players place major pieces freely in their halves.", "Piece movement is related to Makruk and Shatranj.", "Setup phase must be supported before playability."],
    winConditions: ["Checkmate"]
  }),
  catalogEntry({
    id: "ouk-chaktrang",
    name: { english: "Ouk Chaktrang", native: "អុកចត្រង្គ", romanization: "Ouk Chaktrang" },
    aliases: ["cambodian-chess", "ouk"],
    family: "asian-chess",
    region: ["Cambodia"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "Cambodian chess family board." },
    piecePresentation: "makruk-carved",
    playability: "learn",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Cambodian Chess Federation", url: "https://www.cambodianchess.com/" }],
    shortRules: ["Makruk-related movement with Cambodian opening rules.", "Named pieces need Khmer and romanized presentation.", "Counting and tournament profile must be explicit."],
    winConditions: ["Checkmate", "Counting decision in selected profile"]
  }),
  catalogEntry({
    id: "international-draughts",
    name: { english: "International Draughts" },
    aliases: ["polish-draughts", "international-checkers"],
    family: "draughts",
    region: ["Global", "Europe"],
    board: { kind: "square-grid", rows: 10, cols: 10, description: "10x10 board using dark squares." },
    piecePresentation: "draughts-stacks",
    playability: "coming-soon",
    rulesAdapter: "draughts-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "FMJD rules", url: "https://www.fmjd.org/downloads/Annexes/Annex%201%20Rules%20of%20the%20Game.pdf" }],
    shortRules: ["Men move forward diagonally.", "Captures are compulsory.", "Kings fly along diagonals and maximum capture rules apply."],
    winConditions: ["Capture or immobilize all opposing pieces"]
  }),
  catalogEntry({
    id: "english-draughts",
    name: { english: "English Draughts", short: "Checkers" },
    aliases: ["american-checkers"],
    family: "draughts",
    region: ["United Kingdom", "United States"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "8x8 dark-square draughts board." },
    piecePresentation: "draughts-stacks",
    playability: "coming-soon",
    rulesAdapter: "draughts-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "English Draughts Association rules", url: "https://www.english-draughts.org/rules" }],
    shortRules: ["Men move forward diagonally.", "Captures are mandatory.", "Kings move one square diagonally."],
    winConditions: ["Capture all pieces", "Block all legal moves"]
  }),
  catalogEntry({
    id: "turkish-draughts",
    name: { english: "Turkish Draughts", native: "Dama", romanization: "Dama" },
    family: "draughts",
    region: ["Turkey"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "8x8 orthogonal draughts board." },
    piecePresentation: "draughts-stacks",
    playability: "coming-soon",
    rulesAdapter: "draughts-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "MindSports Turkish Draughts rules", url: "https://mindsports.nl/index.php/dagaz/521-turkish-draughts" }],
    shortRules: ["Pieces move orthogonally instead of diagonally.", "Captures are compulsory.", "Kings move like rooks along ranks/files."],
    winConditions: ["Capture or immobilize all opposing pieces"]
  }),
  catalogEntry({
    id: "oware",
    name: { english: "Oware", native: "Oware", romanization: "Warri" },
    aliases: ["awele", "awari", "wari"],
    family: "mancala",
    region: ["Ghana", "West Africa", "Caribbean"],
    board: { kind: "pit-row", rows: 2, pitsPerRow: 6, stores: 0, description: "Two rows of six pits with forty-eight seeds." },
    piecePresentation: "mancala-seeds",
    playability: "coming-soon",
    rulesAdapter: "mancala-engine",
    botAdapter: "mcts",
    ruleSourceLinks: [{ name: "World Oware Federation rules", url: "https://oware.org/rules/" }],
    shortRules: ["Sow seeds counterclockwise.", "Capture when the opponent pit ends with two or three seeds.", "Starvation and grand-slam rules need profile selection."],
    winConditions: ["Capture the majority of seeds", "No further legal feeding moves"]
  }),
  catalogEntry({
    id: "kalah",
    name: { english: "Kalah" },
    aliases: ["mancala-kalah"],
    family: "mancala",
    region: ["Global"],
    board: { kind: "pit-row", rows: 2, pitsPerRow: 6, stores: 2, description: "Two rows of six pits with two stores." },
    piecePresentation: "mancala-seeds",
    playability: "coming-soon",
    rulesAdapter: "mancala-engine",
    botAdapter: "mcts",
    ruleSourceLinks: [{ name: "Mancala World Kalah rules", url: "https://mancala.fandom.com/wiki/Kalah" }],
    shortRules: ["Sow into pits and your own store.", "Landing in your store earns another turn.", "Capture opposite seeds from an empty own pit."],
    winConditions: ["Most seeds after one side is empty"]
  }),
  catalogEntry({
    id: "bao",
    name: { english: "Bao", native: "Bao", romanization: "Bao la Kiswahili" },
    family: "mancala",
    region: ["Kenya", "Tanzania", "East Africa"],
    board: { kind: "pit-row", rows: 4, pitsPerRow: 8, description: "Four-row mancala board with complex sowing." },
    piecePresentation: "mancala-seeds",
    playability: "learn",
    rulesAdapter: "mancala-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Mancala World Bao overview", url: "https://mancala.fandom.com/wiki/Bao" }],
    shortRules: ["Four rows of pits create deep sowing tactics.", "Opening and mtaji phases differ.", "AllChess will mark playable only after phase-specific tests."],
    winConditions: ["Immobilize or capture according to Bao profile"]
  }),
  catalogEntry({
    id: "go-19x19",
    name: { english: "Go", native: "圍棋 / 囲碁 / 바둑", romanization: "Weiqi / Igo / Baduk" },
    aliases: ["weiqi", "baduk", "igo"],
    family: "go-family",
    region: ["China", "Japan", "Korea", "Global"],
    board: { kind: "intersection-grid", rows: 19, cols: 19, description: "19x19 intersection grid with star points." },
    piecePresentation: "go-stones",
    playability: "coming-soon",
    rulesAdapter: "go-engine",
    botAdapter: "mcts",
    ruleSourceLinks: [{ name: "American Go Association rules", url: "https://www.usgo.org/rules-go" }],
    shortRules: ["Place stones on intersections.", "Groups without liberties are captured.", "Scoring uses territory or area based on rules profile."],
    winConditions: ["Highest score after both players pass"]
  }),
  catalogEntry({
    id: "gomoku",
    name: { english: "Gomoku", native: "五目並べ", romanization: "Gomoku Narabe" },
    family: "go-family",
    region: ["Japan", "Global"],
    board: { kind: "intersection-grid", rows: 15, cols: 15, description: "Common 15x15 five-in-a-row grid." },
    piecePresentation: "go-stones",
    playability: "coming-soon",
    rulesAdapter: "go-engine",
    botAdapter: "mcts",
    ruleSourceLinks: [{ name: "Renju International Federation rules", url: "https://www.renju.net/rifrules/" }],
    shortRules: ["Players alternate placing stones.", "First to make an unbroken line of five wins.", "Opening and overline restrictions depend on profile."],
    winConditions: ["Five in a row"]
  }),
  catalogEntry({
    id: "renju",
    name: { english: "Renju", native: "連珠", romanization: "Renju" },
    family: "go-family",
    region: ["Japan", "Global"],
    board: { kind: "intersection-grid", rows: 15, cols: 15, description: "Professional five-in-a-row board." },
    piecePresentation: "go-stones",
    playability: "coming-soon",
    rulesAdapter: "go-engine",
    botAdapter: "mcts",
    ruleSourceLinks: [{ name: "Renju International Federation rules", url: "https://www.renju.net/rifrules/" }],
    shortRules: ["Five in a row wins.", "Black has forbidden move restrictions.", "Opening rules balance first-move advantage."],
    winConditions: ["Legal five in a row", "Opponent forbidden move"]
  }),
  catalogEntry({
    id: "backgammon",
    name: { english: "Backgammon" },
    family: "tables",
    region: ["Global", "Middle East", "Europe"],
    board: { kind: "triangular-points", points: 24, description: "Twenty-four points divided by a center bar." },
    piecePresentation: "backgammon-checkers",
    playability: "coming-soon",
    rulesAdapter: "tables-engine",
    botAdapter: "heuristic",
    ruleSourceLinks: [{ name: "US Backgammon Federation rules", url: "https://usbgf.org/backgammon-rules/" }],
    shortRules: ["Roll dice to move checkers around the board.", "Hit blots and enter from the bar.", "Bear off all checkers to win."],
    winConditions: ["Bear off all checkers first"]
  }),
  catalogEntry({
    id: "narde",
    name: { english: "Narde", native: "Нарды", romanization: "Nardy" },
    family: "tables",
    region: ["Russia", "Central Asia"],
    board: { kind: "triangular-points", points: 24, description: "Tables board where both players race in the same direction." },
    piecePresentation: "backgammon-checkers",
    playability: "learn",
    rulesAdapter: "tables-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Backgammon Galore Narde overview", url: "https://bkgm.com/variants/Narde.html" }],
    shortRules: ["Both sides move in the same direction.", "Hitting is not used in common long narde.", "Blocking restrictions require a rules profile."],
    winConditions: ["Bear off all checkers first"]
  }),
  catalogEntry({
    id: "hnefatafl",
    name: { english: "Hnefatafl", native: "Hnefatafl" },
    aliases: ["viking-chess"],
    family: "tafl",
    region: ["Nordic", "Celtic"],
    board: { kind: "square-grid", rows: 11, cols: 11, description: "11x11 asymmetric escape board with throne and corner squares." },
    piecePresentation: "tafl-runes",
    playability: "coming-soon",
    rulesAdapter: "tafl-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "World Tafl Federation rules", url: "https://aagenielsen.dk/hnefatafl_rules.php" }],
    shortRules: ["Defenders help the king escape.", "Attackers try to capture the king.", "Custodian captures remove surrounded pieces."],
    winConditions: ["King reaches an escape square", "Attackers capture the king"]
  }),
  catalogEntry({
    id: "tablut",
    name: { english: "Tablut" },
    family: "tafl",
    region: ["Sami", "Northern Europe"],
    board: { kind: "square-grid", rows: 9, cols: 9, description: "9x9 tafl board documented by Linnaeus." },
    piecePresentation: "tafl-runes",
    playability: "learn",
    rulesAdapter: "tafl-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Cyningstan Tablut rules", url: "https://www.cyningstan.com/game/125/tablut" }],
    shortRules: ["Asymmetric king escape game.", "Capture is usually by surrounding on opposite sides.", "Historical ambiguities need room-selected profiles."],
    winConditions: ["King escape", "King capture"]
  }),
  catalogEntry({
    id: "pachisi",
    name: { english: "Pachisi", native: "पच्चीसी", romanization: "Pachisi" },
    family: "race",
    region: ["India", "South Asia"],
    board: { kind: "cross-path", arms: 4, pathLength: 68, description: "Cross-shaped race track traditionally played with cowrie shells." },
    piecePresentation: "race-pawns",
    playability: "learn",
    rulesAdapter: "race-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "British Museum Pachisi overview", url: "https://www.britishmuseum.org/collection/term/x50522" }],
    shortRules: ["Race pieces around a cross-shaped path.", "Cowrie throws control movement.", "Safe squares and captures depend on rules profile."],
    winConditions: ["Bring all pieces home first"]
  }),
  catalogEntry({
    id: "ludo",
    name: { english: "Ludo" },
    family: "race",
    region: ["Global"],
    board: { kind: "cross-path", arms: 4, pathLength: 52, description: "Four-color cross race game." },
    piecePresentation: "race-pawns",
    playability: "coming-soon",
    rulesAdapter: "race-engine",
    botAdapter: "heuristic",
    ruleSourceLinks: [{ name: "World Ludo Federation rules", url: "https://worldludofederation.com/rules" }],
    shortRules: ["Roll dice to enter and move pieces.", "Capture sends pieces back home.", "All pieces must finish to win."],
    winConditions: ["Move all pieces to the finish"]
  }),
  catalogEntry({
    id: "royal-game-of-ur",
    name: { english: "Royal Game of Ur" },
    aliases: ["game-of-ur"],
    family: "race",
    region: ["Mesopotamia", "Middle East"],
    board: { kind: "irregular-path", spaces: 20, description: "Twenty-square race board with rosette spaces." },
    piecePresentation: "race-pawns",
    playability: "learn",
    rulesAdapter: "race-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "British Museum Royal Game of Ur", url: "https://www.britishmuseum.org/blog/top-10-historical-board-games" }],
    shortRules: ["Race seven pieces along a shared path.", "Rosette squares grant extra turns in common reconstructions.", "Combat and path rules depend on the selected reconstruction."],
    winConditions: ["Bear all pieces off first"]
  }),
  catalogEntry({
    id: "nine-mens-morris",
    name: { english: "Nine Men's Morris", native: "Mühle", romanization: "Muhle" },
    aliases: ["mill", "morris"],
    family: "mill",
    region: ["Europe", "Global"],
    board: { kind: "concentric-lines", intersections: 24, description: "Three concentric squares connected at side middles." },
    piecePresentation: "mill-stones",
    playability: "coming-soon",
    rulesAdapter: "mill-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "Cyningstan Nine Men's Morris rules", url: "https://www.cyningstan.com/game/11/nine-mens-morris" }],
    shortRules: ["Place stones to make mills of three.", "A mill removes one opposing stone.", "After placement, stones move along connected lines."],
    winConditions: ["Reduce opponent to two stones", "Block all legal moves"]
  }),
  catalogEntry({
    id: "morabaraba",
    name: { english: "Morabaraba" },
    aliases: ["twelve-mens-morris"],
    family: "mill",
    region: ["South Africa"],
    board: { kind: "concentric-lines", intersections: 24, description: "Twelve-stone mill game on a morris-style board." },
    piecePresentation: "mill-stones",
    playability: "learn",
    rulesAdapter: "mill-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Mind Sports South Africa Morabaraba rules", url: "https://www.mindsportssa.org/" }],
    shortRules: ["Twelve stones per side.", "Mills remove enemy stones.", "Flying and repetition policies need a locked rules profile."],
    winConditions: ["Reduce or block the opponent"]
  }),
  catalogEntry({
    id: "bagha-chal",
    name: { english: "Bagh-Chal", native: "बाघ चाल", romanization: "Bagh Chal" },
    aliases: ["tigers-and-goats"],
    family: "regional",
    region: ["Nepal"],
    board: { kind: "concentric-lines", intersections: 25, description: "5x5 point graph for four tigers and twenty goats." },
    piecePresentation: "tafl-runes",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "Cyningstan Bagh Chal rules", url: "https://www.cyningstan.com/game/71/bagh-chal" }],
    shortRules: ["Four tigers try to capture goats.", "Twenty goats try to trap the tigers.", "Goats enter during a placement phase before moving."],
    winConditions: ["Tigers capture enough goats", "Goats immobilize all tigers"]
  }),
  catalogEntry({
    id: "senet",
    name: { english: "Senet" },
    family: "regional",
    region: ["Egypt"],
    board: { kind: "irregular-path", spaces: 30, description: "Three-by-ten path board with special houses." },
    piecePresentation: "race-pawns",
    playability: "learn",
    rulesAdapter: "race-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Metropolitan Museum of Art Senet overview", url: "https://www.metmuseum.org/art/collection/search/544232" }],
    shortRules: ["Ancient Egyptian race game.", "Several reconstructed rulesets exist.", "AllChess will present sources before selecting a playable profile."],
    winConditions: ["Race pieces off the board in selected reconstruction"]
  }),
  catalogEntry({
    id: "yut-nori",
    name: { english: "Yut Nori", native: "윷놀이", romanization: "Yut Nori" },
    aliases: ["yunnori"],
    family: "race",
    region: ["Korea"],
    board: { kind: "cross-path", arms: 4, pathLength: 29, description: "Cross-path race board using yut stick throws." },
    piecePresentation: "race-pawns",
    playability: "learn",
    rulesAdapter: "race-engine",
    botAdapter: "none",
    ruleSourceLinks: [{ name: "Korea.net Yut Nori overview", url: "https://www.korea.net/AboutKorea/Culture-and-the-Arts/Traditional-Games" }],
    shortRules: ["Throw four sticks to determine movement.", "Teams race horses around shortcuts.", "Captures and stacking create tactical swings."],
    winConditions: ["Bring all team pieces home first"]
  }),
  catalogEntry({
    id: "konane",
    name: { english: "Konane", native: "Kōnane", romanization: "Konane" },
    aliases: ["hawaiian-checkers"],
    family: "regional",
    region: ["Hawaii"],
    board: { kind: "square-grid", rows: 8, cols: 8, description: "Alternating stones on a rectangular grid." },
    piecePresentation: "go-stones",
    playability: "coming-soon",
    rulesAdapter: "planned-rules-engine",
    botAdapter: "internal-search",
    ruleSourceLinks: [{ name: "Cyningstan Konane rules", url: "https://www.cyningstan.com/game/97/konane" }],
    shortRules: ["Start with a full checkerboard of stones.", "Players jump orthogonally to capture.", "A player with no legal move loses."],
    winConditions: ["Leave the opponent with no legal move"]
  })
];

export const gameCatalog: GameCatalogEntry[] = [...variantCatalog.map(playableEntryFromVariant), ...learningCatalogEntries];

export function getGameCatalog() {
  return gameCatalog;
}

export function getGameCatalogEntry(idOrAlias: string) {
  const normalized = normalizeCatalogSearch(idOrAlias);
  return gameCatalog.find((entry) =>
    [entry.id, entry.variantKey, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
      .filter(Boolean)
      .some((candidate) => normalizeCatalogSearch(candidate ?? "") === normalized)
  );
}

export function getPlayableGameVerification(variantKey: string): PlayableGameVerification {
  try {
    const completion = getVariantRuleSummary(variantKey).completion;
    if (completion.status === "verified-playable") return completeVerification;
    return incompleteVerification(completion.remainingGates);
  } catch {
    return incompleteVerification(["No verification matrix is registered for this game."]);
  }
}

export function getVerifiedPlayableVariants() {
  return variantCatalog.filter((variant) => isVerificationComplete(getPlayableGameVerification(variant.key))).map((variant) => variant.key);
}

export function searchGameCatalog(query: string, filters: { family?: GameFamilyKey; playability?: PlayabilityStatus } = {}) {
  const normalized = normalizeCatalogSearch(query);
  return gameCatalog.filter((entry) => {
    if (filters.family && entry.family !== filters.family) return false;
    if (filters.playability && entry.playability !== filters.playability) return false;
    if (!normalized) return true;
    return [entry.id, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
      .filter(Boolean)
      .some((candidate) => normalizeCatalogSearch(candidate ?? "").includes(normalized));
  });
}

export function displayGameName(entry: GameCatalogEntry) {
  return [entry.name.english, entry.name.romanization, entry.name.native].filter(Boolean).join(" / ");
}

export function displayPlayabilityStatus(status: PlayabilityStatus) {
  const labels: Record<PlayabilityStatus, string> = {
    playable: "Ready to play",
    learn: "Guide first",
    "coming-soon": "In progress"
  };
  return labels[status];
}

export function displayPiecePresentation(entry: GameCatalogEntry) {
  const labels: Record<PiecePresentationPack, string> = {
    "staunton-svg": "Western chess pieces",
    "shogi-koma": "Native shogi pieces",
    "xiangqi-disk": "Chinese chess disks",
    "makruk-carved": "Thai chess pieces",
    "jungle-animals": "Animal rank pieces",
    "draughts-stacks": "Stacking checkers",
    "mancala-seeds": "Seeds and pits",
    "go-stones": "Stones on lines",
    "backgammon-checkers": "Table checkers",
    "tafl-runes": "King and army pieces",
    "race-pawns": "Race tokens",
    "mill-stones": "Line game stones"
  };
  return labels[entry.piecePresentation];
}

export function displayRulesReadiness(entry: GameCatalogEntry) {
  if (entry.playability === "playable") return "Rules verified";
  if (entry.playability === "learn") return "Rule guide";
  return "Rule draft";
}

export function displayBotReadiness(entry: GameCatalogEntry) {
  if (entry.botAdapter === "none") return "No bot yet";
  if (entry.playability === "playable") return "Bot ready";
  return "Bot planned";
}

export function displayReleaseReadiness(entry: GameCatalogEntry) {
  if (entry.playability === "playable") return "Verified ready";
  if (entry.variantKey) return "Not fully trained";
  return "Researching";
}

export function getCatalogReleaseReadiness(entry: GameCatalogEntry) {
  const label = displayReleaseReadiness(entry);
  if (entry.playability === "playable") {
    return {
      status: "verified-ready" as const,
      label,
      gateComplete: true,
      blockers: [] as string[]
    };
  }

  return {
    status: entry.variantKey ? ("not-fully-trained" as const) : ("researching" as const),
    label,
    gateComplete: false,
    blockers:
      entry.verification?.knownGaps.length
        ? entry.verification.knownGaps
        : ["Rules, bot, review, persistence, and E2E fixtures must pass before this game becomes playable."]
  };
}

export function serializeCatalogEntry(entry: GameCatalogEntry) {
  return {
    ...entry,
    releaseReadiness: getCatalogReleaseReadiness(entry)
  };
}

export function getCatalogStats(entries: GameCatalogEntry[] = gameCatalog): CatalogStats {
  const familyCounts = Object.fromEntries(gameFamilies.map((family) => [family.key, 0])) as CatalogStats["familyCounts"];
  for (const entry of entries) {
    familyCounts[entry.family] += 1;
  }
  return {
    totalGames: entries.length,
    playableGames: entries.filter((entry) => entry.playability === "playable").length,
    learnGames: entries.filter((entry) => entry.playability === "learn").length,
    comingSoonGames: entries.filter((entry) => entry.playability === "coming-soon").length,
    familyCounts
  };
}

export function getLeaderboardScopes(): LeaderboardScope[] {
  return [
    { id: "global", label: "Global rated", ratedOnly: true },
    { id: "playable", label: "Playable games", ratedOnly: true },
    ...gameFamilies.map((family) => ({ id: `family:${family.key}`, label: family.label, family: family.key, ratedOnly: true }))
  ];
}

function normalizeCatalogSearch(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}
