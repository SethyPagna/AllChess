const favoriteGamesKey = "allchess-favorite-games";

/** Catalog entry ids the player starred on this device; empty when storage is unavailable. */
export function readFavoriteGames(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(favoriteGamesKey) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteGame(id: string): boolean {
  const current = readFavoriteGames();
  const favorite = !current.includes(id);
  const next = favorite ? [...current, id] : current.filter((item) => item !== id);
  try { localStorage.setItem(favoriteGamesKey, JSON.stringify(next)); } catch { /* Keep this session's choice. */ }
  return favorite;
}
