"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, Copy, Eye, LinkIcon, Search, Share2, Users } from "lucide-react";

import {
  displayGameName,
  displayModeReadiness,
  gameCatalog,
  gameFamilies,
  getCatalogModeSupport,
  type CatalogPlayMode,
  type GameFamilyKey
} from "@/lib/catalog";
import type { TimeControlKey } from "@/lib/game/time-controls";
import { playGameHref } from "@/lib/routing/play-links";
import type { PlayMode } from "@/components/board/game-board-options";

type PlayMatchHeaderProps = {
  currentVariantKey: string;
  locale: string;
  onOpenGuide: () => void;
  onSelectRoom: () => void;
  onSelectWatch: () => void;
  playMode: PlayMode;
  roomId: string;
  showGuide: boolean;
  timeControl: TimeControlKey;
  title: string;
};

export function PlayMatchHeader({
  currentVariantKey,
  locale,
  onOpenGuide,
  onSelectRoom,
  onSelectWatch,
  playMode,
  roomId,
  showGuide,
  timeControl,
  title
}: PlayMatchHeaderProps) {
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"current" | CatalogPlayMode>("current");
  const [familyFilter, setFamilyFilter] = useState<"all" | GameFamilyKey>("all");
  const gamePickerRef = useRef<HTMLDivElement>(null);
  const gamePickerButtonRef = useRef<HTMLButtonElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const roomHref = playGameHref(locale, currentVariantKey, { mode: "room", time: timeControl, room: roomId });
  const spectateHref = playGameHref(locale, currentVariantKey, { mode: "spectate", time: timeControl, room: roomId });
  const watchHref = `/${locale}/watch?q=${encodeURIComponent(roomId)}&variant=${encodeURIComponent(currentVariantKey)}`;
  const targetMode = modeFilter === "current" ? playMode : modeFilter;
  const playableGames = useMemo(() => gameCatalog.filter((entry) => entry.variantKey), []);
  const filteredGames = useMemo(() => {
    const normalized = normalize(query);
    const matches = playableGames.filter((entry) => {
      if (familyFilter !== "all" && entry.family !== familyFilter) return false;
      if (!getCatalogModeSupport(entry, targetMode).enabled) return false;
      if (!normalized) return true;
      return [entry.id, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
        .filter(Boolean)
        .some((value) => normalize(value ?? "").includes(normalized));
    });

    return matches.slice(0, 10);
  }, [familyFilter, playableGames, query, targetMode]);
  const modeFilters: Array<{ key: "current" | CatalogPlayMode; label: string }> = [
    { key: "current", label: "Current" },
    { key: "bot", label: "Bot" },
    { key: "offline", label: "Local" },
    { key: "online", label: "Online" }
  ];

  useEffect(() => {
    if (!gamePickerOpen && !shareOpen) return;

    function closePicker({ restoreFocus }: { restoreFocus: boolean }) {
      setGamePickerOpen(false);
      if (restoreFocus) {
        gamePickerButtonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !gamePickerRef.current?.contains(target)) {
        closePicker({ restoreFocus: false });
      }
      if (target instanceof Node && !shareRef.current?.contains(target)) {
        setShareOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker({ restoreFocus: true });
        setShareOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [gamePickerOpen, shareOpen]);

  async function copyShare(value: string, label: string) {
    const absoluteValue = value.startsWith("/") ? `${window.location.origin}${value}` : value;
    try {
      await navigator.clipboard?.writeText(absoluteValue);
      setShareNotice(`${label} copied`);
    } catch {
      setShareNotice(`${label}: ${absoluteValue}`);
    }
  }

  return (
    <div className="play-panel-match-header">
      <div className="play-title-block">
        <div className="play-title-row">
          <div ref={gamePickerRef} className="play-title-picker">
            <button ref={gamePickerButtonRef} type="button" className="focus-ring play-title-button" aria-label="Choose game" aria-expanded={gamePickerOpen} aria-controls="play-game-title-picker" onClick={() => setGamePickerOpen((current) => !current)} title="Change game or search other playable games.">
              <h1>{title}</h1>
              <ChevronDown size={18} />
            </button>
            {gamePickerOpen ? (
              <div id="play-game-title-picker" className="play-title-picker-menu" role="dialog" aria-modal="false" aria-label="Choose game">
                <label className="play-title-picker-search">
                  <Search size={15} />
                  <span className="sr-only">Search games</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" autoFocus />
                </label>
                <div className="play-title-picker-filters" aria-label="Game filters">
                  <div className="play-title-picker-chips" aria-label="Mode filter">
                    {modeFilters.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        className={`focus-ring ${modeFilter === filter.key ? "is-selected" : ""}`}
                        aria-pressed={modeFilter === filter.key}
                        onClick={() => setModeFilter(filter.key)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <label className="play-title-picker-family">
                    <span className="sr-only">Game family</span>
                    <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value as "all" | GameFamilyKey)}>
                      <option value="all">All families</option>
                      {gameFamilies.map((family) => (
                        <option key={family.key} value={family.key}>
                          {family.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="play-title-picker-list">
                  {filteredGames.map((entry) => {
                    const support = getCatalogModeSupport(entry, targetMode);
                    return (
                      <Link
                        key={entry.id}
                        href={playGameHref(locale, entry.variantKey, { mode: targetMode, time: timeControl }) as never}
                        className={`focus-ring play-title-picker-row ${entry.variantKey === currentVariantKey ? "is-current" : ""}`}
                        onClick={() => setGamePickerOpen(false)}
                        title={support.reason}
                      >
                        <span>{displayGameName(entry)}</span>
                        <small>{displayModeReadiness(entry, targetMode)}</small>
                      </Link>
                    );
                  })}
                  {!filteredGames.length ? <p>No playable games found.</p> : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="play-title-actions" aria-label="Match actions">
            {showGuide ? (
              <button type="button" title="Open guide, win conditions, and draw notes." onClick={onOpenGuide} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" aria-label="Game guide">
                <BookOpen size={16} />
                <span className="button-label">Guide</span>
              </button>
            ) : null}
            <div ref={shareRef} className="play-share-menu">
              <button type="button" onClick={() => setShareOpen((current) => !current)} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" title="Create a room code, invite link, or spectator link." aria-label="Share game" aria-expanded={shareOpen} aria-controls="play-share-menu">
                <Share2 size={16} />
                <span className="button-label">Share</span>
              </button>
              {shareOpen ? (
                <div id="play-share-menu" className="play-share-menu-panel" role="dialog" aria-label="Share game options">
                  <div className="play-share-code">
                    <span>Room code</span>
                    <code>{roomId}</code>
                    <button type="button" className="focus-ring" onClick={() => void copyShare(roomId, "Room code")} aria-label="Copy room code">
                      <Copy size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="focus-ring play-share-option"
                    onClick={() => {
                      onSelectRoom();
                      setShareOpen(false);
                    }}
                  >
                    <Users size={15} />
                    <span>Room setup</span>
                    <small>Create invite</small>
                  </button>
                  <Link href={roomHref as never} className="focus-ring play-share-option">
                    <LinkIcon size={15} />
                    <span>Play link</span>
                    <small>Opponent joins</small>
                  </Link>
                  <Link
                    href={spectateHref as never}
                    className="focus-ring play-share-option"
                    onClick={() => {
                      onSelectWatch();
                      setShareOpen(false);
                    }}
                  >
                    <Eye size={15} />
                    <span>Spectate link</span>
                    <small>View only</small>
                  </Link>
                  <Link href={watchHref as never} className="focus-ring play-share-option">
                    <Search size={15} />
                    <span>Find room</span>
                    <small>Watch list</small>
                  </Link>
                  <button type="button" className="focus-ring play-share-copy-link" onClick={() => void copyShare(spectateHref, "Spectate link")}>
                    <Copy size={14} />
                    Copy spectator link
                  </button>
                  {shareNotice ? <p role="status">{shareNotice}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
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
