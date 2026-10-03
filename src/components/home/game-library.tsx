"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SavedMatches } from "@/components/board/saved-matches";
import { GameArtwork } from "@/components/games/game-artwork";
import { displayGameName, getCatalogModeSupport, type GameCatalogEntry } from "@/lib/catalog";
import { getGamePresentation } from "@/lib/variants/presentation";
import { playGameHref } from "@/lib/routing/play-links";
import { readFavoriteGames } from "./favorite-games";

const featured = ["classic", "ouk-chaktrang", "shogi", "xiangqi", "english-draughts", "makruk", "jungle", "chess960"];
const homeCardCount = 8;

/** Read-only shelf: starred games first, then the featured order. Search and filters live on the Games page. */
export function GameLibrary({ entries, locale }: { entries: GameCatalogEntry[]; locale: string }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    const saved = readFavoriteGames();
    if (saved.length) queueMicrotask(() => setFavorites(saved));
  }, []);

  const visible = useMemo(() => {
    const playable = entries.filter((entry) => entry.variantKey && (getCatalogModeSupport(entry, "bot").enabled || getCatalogModeSupport(entry, "offline").enabled));
    const starred = favorites.flatMap((id) => playable.find((entry) => entry.id === id) ?? []);
    const rest = playable
      .filter((entry) => featured.includes(entry.variantKey!) && !favorites.includes(entry.id))
      .sort((a, b) => featured.indexOf(a.variantKey!) - featured.indexOf(b.variantKey!));
    return [...starred, ...rest].slice(0, homeCardCount);
  }, [entries, favorites]);

  return (
    <section className="game-library" aria-label="Game library">
      <SavedMatches locale={locale} hideWhenEmpty />
      <div className="library-toolbar">
        <h2>Games</h2>
        <Link href={`/${locale}/variants`} className="library-all-link focus-ring">All games</Link>
      </div>
      <div className="library-grid">
        {visible.map((entry) => {
          const key = entry.variantKey!;
          const presentation = getGamePresentation(key);
          const name = displayGameName(entry);
          const mode = getCatalogModeSupport(entry, "bot").enabled ? "bot" : "offline";
          return (
            <article className="library-card" key={entry.id} data-tone={presentation.tone}>
              <Link className="library-card-link focus-ring" href={playGameHref(locale, key, { mode, time: "rapid" }) as never} aria-label={`Play ${name}`}>
                <GameArtwork variantKey={key} locale={locale} />
                <div className="library-card-copy"><h3 title={name}>{entry.name.english}</h3></div>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
