import type { LocaleCode } from "./locales";

export type VocabularyDomain =
  | "pieces"
  | "actions"
  | "results"
  | "timeControls"
  | "analysis"
  | "accessibility";

export type VocabularyPack = Record<VocabularyDomain, Record<string, string>>;

const english: VocabularyPack = {
  pieces: {
    king: "King",
    queen: "Queen",
    rook: "Rook",
    bishop: "Bishop",
    knight: "Knight",
    pawn: "Pawn",
    general: "General",
    advisor: "Advisor",
    elephant: "Elephant",
    horse: "Horse",
    chariot: "Chariot",
    cannon: "Cannon",
    soldier: "Soldier",
    jadeGeneral: "Jade General",
    goldGeneral: "Gold General",
    silverGeneral: "Silver General",
    lance: "Lance",
    promoted: "Promoted"
  },
  actions: {
    move: "Move",
    capture: "Capture",
    promote: "Promote",
    drop: "Drop",
    castle: "Castle",
    resign: "Resign",
    offerDraw: "Offer draw",
    acceptDraw: "Accept draw",
    declineDraw: "Decline draw",
    rematch: "Rematch",
    save: "Save",
    replay: "Replay"
  },
  results: {
    win: "Win",
    loss: "Loss",
    draw: "Draw",
    checkmate: "Checkmate",
    stalemate: "Stalemate",
    timeout: "Timeout",
    repetition: "Repetition",
    insufficientMaterial: "Insufficient material",
    royalCapture: "Royal capture"
  },
  timeControls: {
    bullet: "Bullet",
    blitz: "Blitz",
    rapid: "Rapid",
    classical: "Classical",
    correspondence: "Correspondence",
    increment: "Increment",
    delay: "Delay"
  },
  analysis: {
    brilliant: "Brilliant",
    best: "Best move",
    excellent: "Excellent",
    good: "Good",
    inaccuracy: "Inaccuracy",
    mistake: "Mistake",
    blunder: "Blunder",
    tactic: "Tactic",
    plan: "Plan",
    training: "Training idea"
  },
  accessibility: {
    board: "Game board",
    selectedSquare: "Selected square",
    legalMove: "Legal move",
    lastMove: "Last move",
    capturedPieces: "Captured pieces",
    playerClock: "Player clock"
  }
};

const partials: Partial<Record<LocaleCode, Partial<VocabularyPack>>> = {
  km: {
    actions: { move: "ដើរ", capture: "ចាប់", resign: "ចុះចាញ់", replay: "លេងឡើងវិញ" },
    results: { win: "ឈ្នះ", loss: "ចាញ់", draw: "ស្មើ", checkmate: "ស្ដេចជាប់" }
  },
  "zh-CN": {
    actions: { move: "走子", capture: "吃子", resign: "认输", replay: "复盘" },
    results: { win: "胜", loss: "负", draw: "和棋", checkmate: "将死" },
    pieces: { king: "王", queen: "后", rook: "车", bishop: "象", knight: "马", pawn: "兵" }
  },
  "zh-TW": {
    actions: { move: "走子", capture: "吃子", resign: "認輸", replay: "復盤" },
    results: { win: "勝", loss: "負", draw: "和棋", checkmate: "將死" },
    pieces: { king: "王", queen: "后", rook: "車", bishop: "象", knight: "馬", pawn: "兵" }
  },
  ja: {
    actions: { move: "指す", capture: "取る", resign: "投了", replay: "再生" },
    results: { win: "勝ち", loss: "負け", draw: "引き分け", checkmate: "詰み" },
    pieces: { king: "王", rook: "飛車", bishop: "角", pawn: "歩", goldGeneral: "金", silverGeneral: "銀" }
  },
  ko: {
    actions: { move: "이동", capture: "잡기", resign: "기권", replay: "다시 보기" },
    results: { win: "승", loss: "패", draw: "무승부", checkmate: "체크메이트" }
  },
  ar: {
    actions: { move: "نقلة", capture: "أسر", resign: "استسلام", replay: "إعادة" },
    results: { win: "فوز", loss: "خسارة", draw: "تعادل", checkmate: "كش مات" }
  }
};

export function getVocabulary(locale: LocaleCode): VocabularyPack {
  const partial = partials[locale] ?? {};
  return {
    pieces: { ...english.pieces, ...partial.pieces },
    actions: { ...english.actions, ...partial.actions },
    results: { ...english.results, ...partial.results },
    timeControls: { ...english.timeControls, ...partial.timeControls },
    analysis: { ...english.analysis, ...partial.analysis },
    accessibility: { ...english.accessibility, ...partial.accessibility }
  };
}
