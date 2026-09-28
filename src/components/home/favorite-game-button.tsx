"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

import { readFavoriteGames, toggleFavoriteGame } from "./favorite-games";

/** Stars a game on this device; starred games lead the home library. */
export function FavoriteGameButton({ gameId }: { gameId: string }) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (readFavoriteGames().includes(gameId)) queueMicrotask(() => setFavorite(true));
  }, [gameId]);

  return (
    <button type="button" className="icon-btn focus-ring" aria-pressed={favorite} aria-label="Favorite" title="Favorite" onClick={() => setFavorite(toggleFavoriteGame(gameId))}>
      <Star aria-hidden="true" size={16} fill={favorite ? "currentColor" : "none"} />
    </button>
  );
}
