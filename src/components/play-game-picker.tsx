"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Info, Play, Radio, Search } from "lucide-react";

import { CatalogInfoOverlay } from "@/components/catalog-browser";
import { displayGameName, displayRulesReadiness, type GameCatalogEntry } from "@/lib/catalog";
import type { LocaleCode } from "@/lib/i18n/locales";

type PlayModeKey = "online" | "bot" | "offline" | "room" | "matchmaking" | "spectate";

export function PlayGamePicker({ entries, locale, selectedMode }: { entries: GameCatalogEntry[]; locale: LocaleCode; selectedMode: PlayModeKey }) {
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
              <button type="button" className="catalog-icon-button focus-ring" aria-label={`Open info for ${displayGameName(entry)}`} title="Info, rules, and setup actions" onClick={() => setSelectedEntry(entry)}>
                <Info size={15} />
              </button>
            </div>
            <div className="play-game-row-actions">
              <Link href={gameModeHref(locale, entry.variantKey, selectedMode)} className="focus-ring action-primary">
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

function gameModeHref(locale: string, variantKey: string | undefined, mode: PlayModeKey) {
  if (mode === "spectate") return `/${locale}/watch` as never;
  if (mode === "bot") return `/${locale}/play/${variantKey}?bot=normal&mode=bot` as never;
  return `/${locale}/play/${variantKey}?mode=${mode}` as never;
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}
