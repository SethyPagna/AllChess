/** Small, game-specific presentation hints. Rules and availability stay in the catalog. */
export type GamePresentation = { tone: string; subtitle: string; motif: string; pieces: string[] };

const presentations: Record<string, GamePresentation> = {
  classic: { tone: "sage", subtitle: "The timeless original", motif: "Est. 1475", pieces: ["n", "k", "q"] },
  chess960: { tone: "slate", subtitle: "A fresh opening every game", motif: "960 openings", pieces: ["b", "r", "n"] },
  crazyhouse: { tone: "plum", subtitle: "Captured pieces return", motif: "Move · capture · drop", pieces: ["n", "q", "p"] },
  shogi: { tone: "sand", subtitle: "Every piece gets a second life", motif: "Japan", pieces: ["b", "k", "r"] },
  "mini-shogi": { tone: "sand", subtitle: "Small board. Big possibilities.", motif: "5 × 5", pieces: ["s", "k", "g"] },
  xiangqi: { tone: "clay", subtitle: "A battle across the river", motif: "China", pieces: ["h", "g", "c"] },
  janggi: { tone: "slate", subtitle: "Command the palace", motif: "Korea", pieces: ["h", "g", "c"] },
  "ouk-chaktrang": { tone: "khmer", subtitle: "Cambodia’s own chess tradition", motif: "កម្ពុជា · Cambodia", pieces: ["n", "k", "m"] },
  makruk: { tone: "sand", subtitle: "A slower, deeper kind of chess", motif: "Thailand", pieces: ["n", "k", "m"] },
  chaturanga: { tone: "sand", subtitle: "Meet the ancestor of chess", motif: "India", pieces: ["n", "k", "e"] },
  shatranj: { tone: "clay", subtitle: "Rediscover an ancient classic", motif: "Persia", pieces: ["n", "k", "f"] },
  jungle: { tone: "sage", subtitle: "Eight animals. One hidden den.", motif: "Jungle", pieces: ["t", "l", "e"] },
  "english-draughts": { tone: "clay", subtitle: "Jump, capture, become a king", motif: "8 × 8", pieces: ["p", "x", "p"] },
  "international-draughts": { tone: "slate", subtitle: "More space for combinations", motif: "10 × 10", pieces: ["p", "x", "p"] },
  "turkish-draughts": { tone: "sand", subtitle: "Think in straight lines", motif: "Türkiye", pieces: ["p", "x", "p"] },
  konane: { tone: "slate", subtitle: "Make the last leap", motif: "Hawaiʻi", pieces: ["p", "p", "p"] },
  antichess: { tone: "plum", subtitle: "Lose your army. Win the game.", motif: "Reverse the rules", pieces: ["p", "k", "n"] },
  horde: { tone: "clay", subtitle: "An army against a swarm", motif: "Unequal armies", pieces: ["p", "p", "k"] },
  "king-of-the-hill": { tone: "sage", subtitle: "Race your king to the center", motif: "Own the center", pieces: ["p", "k", "p"] },
  "three-check": { tone: "plum", subtitle: "Three checks settle the score", motif: "1 · 2 · 3", pieces: ["b", "k", "q"] },
  "racing-kings": { tone: "slate", subtitle: "First king across the line", motif: "Race to rank 8", pieces: ["r", "k", "n"] }
};

export function getGamePresentation(variantKey: string): GamePresentation {
  return presentations[variantKey] ?? { tone: "sage", subtitle: "Find your next favorite", motif: "AllChess", pieces: ["n", "k", "q"] };
}
