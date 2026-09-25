"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Bot, Search, Star, Users, X } from "lucide-react";

import { SavedMatches } from "@/components/board/saved-matches";
import { PieceIcon } from "@/components/board/piece-icon";
import { displayGameName, getCatalogModeSupport, type CatalogPlayMode, type GameCatalogEntry } from "@/lib/catalog";
import { getGamePresentation } from "@/lib/variants/presentation";
import { getVariant } from "@/lib/variants/catalog";
import { playGameHref } from "@/lib/routing/play-links";

const favoritesKey = "allchess-favorite-games";
const filters = ["Discover", "All games", "Favorites", "Chess", "Asian", "Checkers"] as const;
type Filter = typeof filters[number];
const featured = ["classic", "ouk-chaktrang", "shogi", "xiangqi", "english-draughts", "makruk", "jungle", "chess960"];

export function GameLibrary({ entries, locale }: { entries: GameCatalogEntry[]; locale: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Discover");
  const [mode, setMode] = useState<CatalogPlayMode>("bot");
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(favoritesKey) ?? "[]");
      if (Array.isArray(saved)) queueMicrotask(() => setFavorites(saved.filter((id): id is string => typeof id === "string")));
    } catch { /* Favorites are optional when storage is restricted. */ }
  }, []);

  const playable = useMemo(() => entries.filter((entry) => entry.variantKey && getCatalogModeSupport(entry, mode).enabled), [entries, mode]);
  const visible = playable.filter((entry) => {
    const text = [entry.name.english, entry.name.native, ...entry.aliases].join(" ").normalize("NFKC").toLocaleLowerCase();
    if (query.trim() && !text.includes(query.trim().normalize("NFKC").toLocaleLowerCase())) return false;
    if (filter === "Favorites") return favorites.includes(entry.id);
    if (filter === "Chess") return entry.family === "chess-family";
    if (filter === "Asian") return entry.family === "asian-chess";
    if (filter === "Checkers") return entry.family === "draughts";
    return filter !== "Discover" || Boolean(query.trim()) || featured.includes(entry.variantKey!);
  }).sort((a, b) => {
    if (filter !== "Discover" || query.trim()) return 0;
    return featured.indexOf(a.variantKey!) - featured.indexOf(b.variantKey!);
  });

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem(favoritesKey, JSON.stringify(next)); } catch { /* Keep this session's choice. */ }
  }

  return (
    <section className="game-library" aria-label="Game library">
      <SavedMatches locale={locale} />
      <div className="library-heading">
        <div><span className="studio-eyebrow">A world of strategy</span><h2>Find your next move.</h2></div>
        <div className="library-mode" role="group" aria-label="Library play mode">
          <button type="button" className="focus-ring" aria-pressed={mode === "bot"} onClick={() => setMode("bot")}><Bot size={16} /> Play a bot</button>
          <button type="button" className="focus-ring" aria-pressed={mode === "offline"} onClick={() => setMode("offline")}><Users size={16} /> Local two-player</button>
          {([{ key: "room", label: "Friend" }, { key: "online", label: "Quick match" }, { key: "spectate", label: "Watch" }] as const).map(item => <button type="button" className="focus-ring" key={item.key} aria-pressed={mode === item.key} onClick={() => setMode(item.key)}>{item.label}</button>)}
        </div>
      </div>
      <div className="library-toolbar">
        <div className="library-filters" role="group" aria-label="Filter game library">
          {filters.map((item) => <button type="button" key={item} className="focus-ring" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "Favorites" ? <Star size={14} /> : null}{item}</button>)}
        </div>
        <label className="library-search"><Search size={16} /><input aria-label="Search game library" placeholder="Find a game…" value={query} onChange={(event) => setQuery(event.target.value)} />{query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button> : null}</label>
      </div>
      <div className="library-grid">
        {visible.map((entry) => {
          const key = entry.variantKey!;
          const presentation = getGamePresentation(key);
          const variant = getVariant(key);
          const name = displayGameName(entry);
          const favorite = favorites.includes(entry.id);
          return (
            <article className="library-card" key={entry.id} data-tone={presentation.tone}>
              <Link className="library-card-link focus-ring" href={playGameHref(locale, key, { mode, time: "rapid" }) as never} aria-label={`${mode === "spectate" ? "Watch" : "Play"} ${name}`}>
                <div className="library-art" aria-hidden="true">
                  <span className="library-motif">{presentation.motif}</span>
                  <div className="library-art-grid" />
                  <div className="library-piece-group">{presentation.pieces.map((code, index) => <span key={index}><PieceIcon code={code} owner={variant.players[index === 2 ? 1 : 0]} variantKey={key} locale={locale} /></span>)}</div>
                  <span className="library-board-size">{variant.board.cols} × {variant.board.rows}</span>
                </div>
                <div className="library-card-copy"><div><h3 title={name}>{entry.name.english}</h3><p>{presentation.subtitle}</p></div><ArrowUpRight size={19} /></div>
              </Link>
              <button type="button" className="library-favorite focus-ring" aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${name}`} aria-pressed={favorite} onClick={() => toggleFavorite(entry.id)}><Star size={16} fill={favorite ? "currentColor" : "none"} /></button>
            </article>
          );
        })}
      </div>
      {!visible.length ? <div className="library-empty"><Search size={24} /><h3>{filter === "Favorites" && !query ? "Your favorites belong here" : "No games found"}</h3><p>{filter === "Favorites" && !query ? "Tap a star on any game to keep it close." : "Try another search, game family, or play mode."}</p><button type="button" className="action-secondary focus-ring" onClick={() => { setFilter("All games"); setQuery(""); }}>Browse games</button></div> : null}
      <div className="library-footer"><span aria-live="polite">{visible.length} of {playable.length} games</span>{filter === "Discover" && !query ? <button type="button" className="focus-ring" onClick={() => setFilter("All games")}>Explore all {playable.length} games <ArrowUpRight size={15} /></button> : null}<Link href={`/${locale}/variants`}><BookOpen size={15} /> Rules & guides</Link></div>
    </section>
  );
}
