"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, Eye, Search, Share2, Swords } from "lucide-react";

import { displayGameName, gameCatalog } from "@/lib/catalog";
import type { TimeControlKey } from "@/lib/game/time-controls";
import { playGameHref } from "@/lib/routing/play-links";
import type { PlayMode } from "@/components/board/game-board-options";

type PlayMatchHeaderProps = {
  currentVariantKey: string;
  locale: string;
  meta: string;
  modeSummary: string;
  objective: string;
  onOpenGuide: () => void;
  onSelectRoom: () => void;
  onSelectWatch: () => void;
  phaseLabel: string;
  playMode: PlayMode;
  showGuide: boolean;
  timeControl: TimeControlKey;
  title: string;
};

export function PlayMatchHeader({
  currentVariantKey,
  locale,
  meta,
  modeSummary,
  objective,
  onOpenGuide,
  onSelectRoom,
  onSelectWatch,
  phaseLabel,
  playMode,
  showGuide,
  timeControl,
  title
}: PlayMatchHeaderProps) {
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const playableGames = useMemo(() => gameCatalog.filter((entry) => entry.playability === "playable" && entry.variantKey), []);
  const filteredGames = useMemo(() => {
    const normalized = normalize(query);
    const matches = normalized
      ? playableGames.filter((entry) =>
          [entry.id, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
            .filter(Boolean)
            .some((value) => normalize(value ?? "").includes(normalized))
        )
      : playableGames;

    return matches.slice(0, 8);
  }, [playableGames, query]);

  return (
    <div className="play-panel-match-header">
      <div className="play-title-block">
        <div className="play-title-row">
          <div className="play-title-picker">
            <button type="button" className="focus-ring play-title-button" aria-label="Choose game" aria-expanded={gamePickerOpen} aria-controls="play-game-title-picker" onClick={() => setGamePickerOpen((current) => !current)} title="Change game or search other playable games.">
              <h1>{title}</h1>
              <ChevronDown size={18} />
            </button>
            {gamePickerOpen ? (
              <div id="play-game-title-picker" className="play-title-picker-menu" role="dialog" aria-label="Choose game">
                <label className="play-title-picker-search">
                  <Search size={15} />
                  <span className="sr-only">Search games</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" autoFocus />
                </label>
                <div className="play-title-picker-list">
                  {filteredGames.map((entry) => (
                    <Link
                      key={entry.id}
                      href={playGameHref(locale, entry.variantKey, { mode: playMode, time: timeControl }) as never}
                      className={`focus-ring play-title-picker-row ${entry.variantKey === currentVariantKey ? "is-current" : ""}`}
                      onClick={() => setGamePickerOpen(false)}
                    >
                      <span>{displayGameName(entry)}</span>
                      <small>{entry.board.description}</small>
                    </Link>
                  ))}
                  {!filteredGames.length ? <p>No playable games found.</p> : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="play-title-actions" aria-label="Match actions">
            {showGuide ? (
              <button type="button" title="Open guide, win conditions, and draw notes." onClick={onOpenGuide} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" aria-label="Game guide">
                <BookOpen size={16} />
                Guide
              </button>
            ) : null}
            <button type="button" onClick={onSelectRoom} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title="Switch to room setup for a shareable game.">
              <Share2 size={16} />
              <span className="button-label">Room</span>
            </button>
            <button type="button" onClick={onSelectWatch} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title="Switch to spectator mode for live rooms.">
              <Eye size={16} />
              <span className="button-label">Watch</span>
            </button>
          </div>
        </div>
        <div className="play-title-meta" aria-label="Match summary">
          <span className="inline-flex items-center gap-2">
            <Swords size={14} />
            {meta}
          </span>
          <strong title={objective}>{modeSummary}</strong>
          <em>{phaseLabel}</em>
        </div>
      </div>
    </div>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}
