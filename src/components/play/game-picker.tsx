"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Play, Radio, Search } from "lucide-react";

import { CatalogInfoOverlay } from "@/components/catalog/catalog-browser";
import { displayGameName, displayRulesReadiness, type GameCatalogEntry } from "@/lib/catalog";
import type { TimeControlKey } from "@/lib/game/time-controls";
import type { LocaleCode } from "@/lib/i18n/locales";
import { playGameHref } from "@/lib/routing/play-links";

type PlayModeKey = "online" | "bot" | "offline" | "room" | "matchmaking" | "spectate";

export function PlayGamePicker({
  entries,
  locale,
  selectedMode,
  selectedTimeControl
}: {
  entries: GameCatalogEntry[];
  locale: LocaleCode;
  selectedMode: PlayModeKey;
  selectedTimeControl: TimeControlKey;
}) {
  const [query, setQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<GameCatalogEntry | null>(null);

  const filtered = useMemo(() => {
    const normalized = normalize(query);
    const matches = normalized
      ? entries.filter((entry) =>
          [entry.id, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
            .filter(Boolean)
            .some((value) => normalize(value ?? "").includes(normalized))
        )
      : entries;
    return matches.slice(0, 12);
  }, [entries, query]);

  return (
    <>
      <div className="play-game-picker-toolbar">
        <label className="catalog-search focus-within:ring-2 focus-within:ring-[var(--accent)]">
          <Search size={18} />
          <span className="sr-only">Search playable games</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search playable games" />
        </label>
        <span>{filtered.length} shown</span>
      </div>
      <div className="play-game-list">
        {filtered.map((entry) => (
          <article key={entry.id} className="play-game-row">
            <div className="play-game-row-main">
              <Radio size={16} />
              <strong>{displayGameName(entry)}</strong>
              <span>{displayRulesReadiness(entry)}</span>
              <button type="button" className="catalog-guide-button focus-ring" aria-label={`Open guide for ${displayGameName(entry)}`} title="Guide, rules, and setup actions" onClick={() => setSelectedEntry(entry)}>
                <BookOpen size={15} />
                <span>Guide</span>
              </button>
            </div>
            <div className="play-game-row-actions">
              <Link href={playGameHref(locale, entry.variantKey, { mode: selectedMode, time: selectedTimeControl }) as never} className="focus-ring action-primary">
                <Play size={14} />
                {modeActionLabel(selectedMode)}
              </Link>
            </div>
          </article>
        ))}
        {!filtered.length ? <p className="play-game-empty">No playable games match that search.</p> : null}
      </div>
      {selectedEntry ? <CatalogInfoOverlay entry={selectedEntry} locale={locale} onClose={() => setSelectedEntry(null)} /> : null}
    </>
  );
}

function modeActionLabel(mode: PlayModeKey) {
  const labels: Record<PlayModeKey, string> = {
    online: "Play",
    bot: "Bot",
    offline: "Local",
    room: "Room",
    matchmaking: "Match",
    spectate: "Watch"
  };
  return labels[mode];
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}
