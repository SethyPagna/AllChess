export type BotTierKey = "easy" | "normal" | "hard" | "very-hard" | "grandmaster" | "legend";

export type BotEloCalibrationStatus = "stockfish-calibrated" | "allchess-estimated" | "variant-provisional" | "rules-gated";

export type BotStrengthBand = {
  tier: BotTierKey;
  label: string;
  minElo: number;
  maxElo?: number;
  targetElo: number;
  stockfishUciElo: number;
  display: string;
  calibrationStatus: BotEloCalibrationStatus;
  basis: string;
};

export type VariantBotStrengthProfile = BotStrengthBand & {
  variantKey: string;
};

const stockfishUciMinElo = 1320;
const stockfishUciMaxElo = 3190;

const baseStrengthBands: Record<BotTierKey, BotStrengthBand> = {
  easy: {
    tier: "easy",
    label: "Easy",
    minElo: 900,
    maxElo: 1200,
    targetElo: 1050,
    stockfishUciElo: stockfishUciMinElo,
    display: "900-1200 Elo-style",
    calibrationStatus: "allchess-estimated",
    basis: "Below Stockfish's UCI_Elo floor; enforced with shallow search, small node budgets, rescue heuristics, and legal tactical filters."
  },
  normal: {
    tier: "normal",
    label: "Normal",
    minElo: 1300,
    maxElo: 1600,
    targetElo: 1450,
    stockfishUciElo: 1450,
    display: "1300-1600 Elo-style",
    calibrationStatus: "stockfish-calibrated",
    basis: "Uses Stockfish UCI_LimitStrength/UCI_Elo where supported, plus AllChess internal-search limits."
  },
  hard: {
    tier: "hard",
    label: "Hard",
    minElo: 1700,
    maxElo: 2000,
    targetElo: 1900,
    stockfishUciElo: 1900,
    display: "1700-2000 Elo-style",
    calibrationStatus: "stockfish-calibrated",
    basis: "Uses Stockfish UCI_LimitStrength/UCI_Elo where supported, plus stronger reply and hanging-piece checks."
  },
  "very-hard": {
    tier: "very-hard",
    label: "Very Hard",
    minElo: 2100,
    maxElo: 2400,
    targetElo: 2300,
    stockfishUciElo: 2300,
    display: "2100-2400 Elo-style",
    calibrationStatus: "stockfish-calibrated",
    basis: "Uses Stockfish UCI_LimitStrength/UCI_Elo where supported, plus deeper tactical and positional search."
  },
  grandmaster: {
    tier: "grandmaster",
    label: "Grandmaster",
    minElo: 2700,
    maxElo: 2900,
    targetElo: 2850,
    stockfishUciElo: 2850,
    display: "2700-2900 Elo-style",
    calibrationStatus: "stockfish-calibrated",
    basis: "Uses high Stockfish UCI_Elo settings where supported and cache-first tactical knowledge."
  },
  legend: {
    tier: "legend",
    label: "Legend",
    minElo: stockfishUciMaxElo,
    targetElo: stockfishUciMaxElo,
    stockfishUciElo: stockfishUciMaxElo,
    display: "3190+ benchmark",
    calibrationStatus: "stockfish-calibrated",
    basis: "Highest calibrated band for supported chess rules. The exact public rating stays benchmark-based instead of pretending to be a human rating."
  }
};

const stockfishCalibratedVariants = new Set(["classic", "chess960"]);
const rulesGatedVariants = new Set(["shogi", "janggi", "makruk", "jungle", "antichess", "horde"]);

export function getBotStrengthBand(tier: BotTierKey) {
  return baseStrengthBands[tier];
}

export function listBotStrengthBands() {
  return Object.values(baseStrengthBands);
}

export function getVariantBotStrengthProfile(variantKey: string, tier: BotTierKey): VariantBotStrengthProfile {
  const band = getBotStrengthBand(tier);
  if (stockfishCalibratedVariants.has(variantKey)) {
    return { ...band, variantKey };
  }
  if (rulesGatedVariants.has(variantKey)) {
    return {
      ...band,
      variantKey,
      calibrationStatus: "rules-gated",
      basis: `${variantKey} uses the same tier budgets, but Elo-style claims are disabled until native-rule fixtures and bot gauntlets are complete.`
    };
  }
  return {
    ...band,
    variantKey,
    calibrationStatus: "variant-provisional",
    basis: `${variantKey} uses the same AllChess strength ladder, but its Elo-style range is provisional until variant-specific benchmarks are recorded.`
  };
}
