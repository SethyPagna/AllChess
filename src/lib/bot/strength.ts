export const botEloBandKeys = [
  "elo-100-200",
  "elo-200-300",
  "elo-300-400",
  "elo-400-500",
  "elo-500-600",
  "elo-600-700",
  "elo-700-800",
  "elo-800-900",
  "elo-900-1000",
  "elo-1000-1100",
  "elo-1100-1200",
  "elo-1200-1300",
  "elo-1300-1400",
  "elo-1400-1500",
  "elo-1500-1600",
  "elo-1600-1700",
  "elo-1700-1800",
  "elo-1800-1900",
  "elo-1900-2000",
  "elo-2000-2100",
  "elo-2100-2200",
  "elo-2200-2300",
  "elo-2300-2400",
  "elo-2400-2500",
  "elo-2500-2600",
  "elo-2600-2700",
  "elo-2700-2800",
  "elo-2800-2900",
  "elo-2900-3000",
  "elo-3000-3100",
  "elo-3100-3200",
  "elo-3200-3300",
  "elo-3300-3400",
  "elo-3400-3500",
  "elo-3500-3600",
  "elo-3600-3700",
  "elo-3700-3800",
  "elo-3800-3900",
  "elo-3900-4000"
] as const;

export const legacyBotTierKeys = ["easy", "normal", "hard", "very-hard", "grandmaster", "legend"] as const;

export type BotEloBandKey = (typeof botEloBandKeys)[number];
export type LegacyBotTierKey = (typeof legacyBotTierKeys)[number];
export type BotTierKey = BotEloBandKey | LegacyBotTierKey;

export type BotEloCalibrationStatus = "stockfish-calibrated" | "allchess-estimated" | "variant-provisional" | "rules-gated" | "benchmark-ceiling";

export type BotStrengthBand = {
  tier: BotEloBandKey;
  label: string;
  minElo: number;
  maxElo: number;
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
const stockfishCalibratedVariants = new Set(["classic", "chess960"]);
const rulesGatedVariants = new Set<string>();

const legacyTierAliases: Record<LegacyBotTierKey, BotEloBandKey> = {
  easy: "elo-1000-1100",
  normal: "elo-1400-1500",
  hard: "elo-1900-2000",
  "very-hard": "elo-2300-2400",
  grandmaster: "elo-2800-2900",
  legend: "elo-3900-4000"
};

const baseStrengthBands: Record<BotEloBandKey, BotStrengthBand> = Object.fromEntries(botEloBandKeys.map((tier) => {
  const [minElo, maxElo] = parseEloBandKey(tier);
  const targetElo = Math.round((minElo + maxElo) / 2);
  const stockfishUciElo = clamp(targetElo, stockfishUciMinElo, stockfishUciMaxElo);
  const calibrationStatus = targetElo < stockfishUciMinElo ? "allchess-estimated" : targetElo > stockfishUciMaxElo ? "benchmark-ceiling" : "stockfish-calibrated";

  return [
    tier,
    {
      tier,
      label: `${minElo}-${maxElo}`,
      minElo,
      maxElo,
      targetElo,
      stockfishUciElo,
      display: `${minElo}-${maxElo} Elo-style`,
      calibrationStatus,
      basis: basisForBand({ calibrationStatus, maxElo, minElo, stockfishUciElo, targetElo })
    }
  ];
})) as Record<BotEloBandKey, BotStrengthBand>;

export function normalizeBotTierKey(tier: BotTierKey): BotEloBandKey {
  if (isBotEloBandKey(tier)) return tier;
  return legacyTierAliases[tier];
}

export function isBotEloBandKey(value: string): value is BotEloBandKey {
  return (botEloBandKeys as readonly string[]).includes(value);
}

export function isLegacyBotTierKey(value: string): value is LegacyBotTierKey {
  return (legacyBotTierKeys as readonly string[]).includes(value);
}

export function isBotTierKey(value: string): value is BotTierKey {
  return isBotEloBandKey(value) || isLegacyBotTierKey(value);
}

export function getBotStrengthBand(tier: BotTierKey) {
  return baseStrengthBands[normalizeBotTierKey(tier)];
}

export function listBotStrengthBands() {
  return botEloBandKeys.map((tier) => baseStrengthBands[tier]);
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

function parseEloBandKey(tier: BotEloBandKey) {
  const match = tier.match(/^elo-(\d+)-(\d+)$/);
  if (!match) throw new Error(`Invalid bot Elo band key: ${tier}`);
  return [Number(match[1]), Number(match[2])] as const;
}

function basisForBand({
  calibrationStatus,
  maxElo,
  minElo,
  stockfishUciElo,
  targetElo
}: {
  calibrationStatus: BotEloCalibrationStatus;
  maxElo: number;
  minElo: number;
  stockfishUciElo: number;
  targetElo: number;
}) {
  if (calibrationStatus === "allchess-estimated") {
    return `${minElo}-${maxElo} is below Stockfish's UCI_Elo floor, so AllChess enforces the band with shallow search, tighter node budgets, tactical filters, and controlled move noise.`;
  }
  if (calibrationStatus === "benchmark-ceiling") {
    return `${minElo}-${maxElo} is above Stockfish's exposed UCI_Elo ceiling. The live engine is capped at UCI_Elo ${stockfishUciElo}, then AllChess adds deeper search, cache-first labels, and stricter anti-blunder checks; it is a benchmark tier, not a certified human rating.`;
  }
  return `${minElo}-${maxElo} uses Stockfish UCI_LimitStrength/UCI_Elo ${targetElo} where supported, plus AllChess legal validation, reply checks, and cache-first opening/tactic knowledge.`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
