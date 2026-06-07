import { listBotStrengthBands, normalizeBotTierKey, type BotEloBandKey, type BotStrengthBand, type BotTierKey } from "@/lib/bot/strength";

export const MAX_BOT_REPLY_MS = 2800;

export type { BotTierKey } from "@/lib/bot/strength";
export type BotDifficultyKey = BotTierKey;
export type BotPlayStyle = "balanced" | "tactical" | "positional" | "defensive" | "wild";

export type BotDifficulty = {
  key: BotEloBandKey;
  label: string;
  estimatedStrength: string;
  strength: BotStrengthBand;
  benchmarkVersion: string;
  depth: number;
  moveTimeMs: number;
  skill: number;
  nodeBudget: number;
  beamWidth: number;
  quiescenceDepth: number;
  riskTolerance: number;
  replyCheckWidth: number;
  knowledgeMinimumConfidence: number;
};

export const botDifficultyLevels: BotDifficulty[] = listBotStrengthBands().map((strength) => {
  const progress = (strength.targetElo - 150) / (3950 - 150);
  return {
    key: strength.tier,
    label: `${strength.label} Elo`,
    estimatedStrength: estimatedStrengthForBand(strength),
    strength,
    benchmarkVersion: "allchess-bench-v3-elo-bands",
    depth: Math.round(interpolate(3, 8, progress)),
    moveTimeMs: Math.round(interpolate(220, 2600, progress)),
    skill: Math.round(interpolate(8, 20, progress)),
    nodeBudget: Math.round(interpolate(360, 30000, progress)),
    beamWidth: Math.round(interpolate(8, 48, progress)),
    quiescenceDepth: Math.max(1, Math.round(interpolate(1, 4, progress))),
    riskTolerance: Number(interpolate(0.42, 0.03, progress).toFixed(2)),
    replyCheckWidth: Math.round(interpolate(5, 26, progress)),
    knowledgeMinimumConfidence: Number(interpolate(0.78, 0.54, progress).toFixed(2))
  };
});

const botDifficultyByKey = new Map<BotEloBandKey, BotDifficulty>(botDifficultyLevels.map((level) => [level.key, level]));

export function getBotDifficultyLevel(key: BotTierKey) {
  const normalizedKey = normalizeBotTierKey(key);
  return botDifficultyByKey.get(normalizedKey) ?? botDifficultyByKey.get("elo-1400-1500") ?? botDifficultyLevels[0];
}

export function isBeginnerBotDifficulty(difficulty: BotDifficulty) {
  return difficulty.strength.targetElo < 1200;
}

export function isCeilingBotDifficulty(difficulty: BotDifficulty) {
  return difficulty.strength.targetElo >= 3200;
}

export function isMasterBotDifficulty(difficulty: BotDifficulty) {
  return difficulty.strength.targetElo >= 2800;
}

function estimatedStrengthForBand(strength: BotStrengthBand) {
  if (strength.targetElo < 600) return "Learning tier: legal moves, obvious tactics, and high forgiveness";
  if (strength.targetElo < 1200) return "Beginner tier: legal, safer, tactical, and still very beatable";
  if (strength.targetElo < 1800) return "Club tier: basic tactics, defended pieces, and one-reply checks";
  if (strength.targetElo < 2400) return "Expert tier: stronger tactics, counterplay, and positional filters";
  if (strength.targetElo < 3200) return "Engine-calibrated tier: high Stockfish UCI strength plus AllChess validation";
  return "Benchmark ceiling tier: Stockfish cap plus deeper cache-first AllChess search";
}

function interpolate(min: number, max: number, progress: number) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  return min + (max - min) * boundedProgress;
}
