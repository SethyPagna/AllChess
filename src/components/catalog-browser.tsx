"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Bot, Filter, Info, Play, RotateCcw, Search, X } from "lucide-react";

import {
  displayBotReadiness,
  displayGameName,
  displayPiecePresentation,
  displayPlayabilityStatus,
  displayReleaseReadiness,
  displayRulesReadiness,
  gameFamilies,
  type GameCatalogEntry,
  type GameFamilyKey,
  type PlayabilityStatus
} from "@/lib/catalog";
import type { LocaleCode } from "@/lib/i18n/locales";

type CatalogBrowserProps = {
  entries: GameCatalogEntry[];
  initialFamily?: GameFamilyKey | "all";
  initialStatus?: PlayabilityStatus | "all";
  locale: LocaleCode;
};

const playabilityLabels: Record<PlayabilityStatus | "all", string> = {
  all: "All",
  playable: "Ready to play",
  learn: "Learn first",
  "coming-soon": "In progress"
};

export function CatalogBrowser({ entries, initialFamily = "all", initialStatus = "all", locale }: CatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<GameFamilyKey | "all">(initialFamily);
  const [status, setStatus] = useState<PlayabilityStatus | "all">(initialStatus);
  const [selectedEntry, setSelectedEntry] = useState<GameCatalogEntry | null>(null);

  const filtered = useMemo(() => {
    const normalized = normalize(query);
    return entries.filter((entry) => {
      if (family !== "all" && entry.family !== family) return false;
      if (status !== "all" && entry.playability !== status) return false;
      if (!normalized) return true;
      return [entry.id, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
        .filter(Boolean)
        .some((value) => normalize(value ?? "").includes(normalized));
    });
  }, [entries, family, query, status]);
  const hasFilters = Boolean(query) || family !== "all" || status !== "all";

  return (
    <section className="catalog-browser">
      <div className="catalog-toolbar panel">
        <label className="catalog-search focus-within:ring-2 focus-within:ring-[var(--accent)]">
          <Search size={18} />
          <span className="sr-only">Search games</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, aliases, native names" />
        </label>
        <label className="catalog-select">
          <Filter size={16} />
          <span className="sr-only">Family</span>
          <select value={family} onChange={(event) => setFamily(event.target.value as GameFamilyKey | "all")}>
            <option value="all">All families</option>
            {gameFamilies.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-select">
          <Play size={16} />
          <span className="sr-only">Playability</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as PlayabilityStatus | "all")}>
            {Object.entries(playabilityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {hasFilters ? (
          <button
            type="button"
            className="catalog-reset focus-ring"
            onClick={() => {
              setQuery("");
              setFamily("all");
              setStatus("all");
            }}
          >
            <RotateCcw size={15} />
            Clear
          </button>
        ) : null}
      </div>
      <div className="catalog-count">Showing {filtered.length} of {entries.length} games</div>
      <div className="catalog-grid">
        {filtered.map((entry) => (
          <article key={entry.id} className="panel catalog-card">
            <div className="catalog-card-head">
              <div>
                <h2>{displayGameName(entry)}</h2>
                <p>{gameFamilies.find((item) => item.key === entry.family)?.label}</p>
              </div>
              <button type="button" className="catalog-icon-button focus-ring" aria-label={`Open info for ${displayGameName(entry)}`} title="Info, rules, and actions" onClick={() => setSelectedEntry(entry)}>
                <Info size={16} />
              </button>
            </div>
            <p className="catalog-card-summary">{entry.shortRules[0] ?? entry.winConditions[0]}</p>
            <div className="catalog-card-actions">
              {entry.playability === "playable" && entry.variantKey ? (
                <Link href={`/${locale}/play/${entry.variantKey}`} className="action-primary focus-ring">
                  <Play size={16} />
                  Play
                </Link>
              ) : (
                <button type="button" className="action-secondary focus-ring" onClick={() => setSelectedEntry(entry)}>
                  <BookOpen size={16} />
                  Guide
                </button>
              )}
              <span className="catalog-status" data-status={entry.playability}>
                {displayPlayabilityStatus(entry.playability)}
              </span>
            </div>
          </article>
        ))}
      </div>
      {selectedEntry ? <CatalogRulesOverlay entry={selectedEntry} locale={locale} onClose={() => setSelectedEntry(null)} /> : null}
      {!filtered.length ? (
        <div className="panel catalog-empty-state">
          <Search size={22} />
          <h2>No matching games</h2>
          <p>Try another family, a native name, a romanized name, or clear the filters.</p>
          <button
            type="button"
            className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2"
            onClick={() => {
              setQuery("");
              setFamily("all");
              setStatus("all");
            }}
          >
            <RotateCcw size={15} />
            Show all games
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CatalogRulesOverlay({ entry, locale, onClose }: { entry: GameCatalogEntry; locale: LocaleCode; onClose: () => void }) {
  const playHref = entry.variantKey ? `/${locale}/play/${entry.variantKey}` : `/${locale}/games/${entry.id}`;

  return (
    <div className="catalog-rules-backdrop" role="presentation" onClick={onClose}>
      <section className="catalog-rules-sheet panel" role="dialog" aria-modal="true" aria-label={`${displayGameName(entry)} info`} onClick={(event) => event.stopPropagation()}>
        <div className="catalog-rules-head">
          <div>
            <span>{gameFamilies.find((item) => item.key === entry.family)?.label}</span>
            <h2>{displayGameName(entry)}</h2>
          </div>
          <button type="button" className="catalog-icon-button focus-ring" aria-label="Close info" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="catalog-rules-actions">
          {entry.playability === "playable" && entry.variantKey ? (
            <Link href={playHref as never} className="action-primary focus-ring">
              <Play size={16} />
              Play
            </Link>
          ) : null}
          {entry.playability === "playable" && entry.variantKey ? (
            <Link href={`/${locale}/play/${entry.variantKey}?mode=bot`} className="action-secondary focus-ring">
              <Bot size={16} />
              Bot Mode
            </Link>
          ) : null}
          <Link href={`/${locale}/games/${entry.id}` as never} className="action-secondary focus-ring">
            <BookOpen size={16} />
            Full Guide
          </Link>
        </div>
        <div className="catalog-rules-grid">
          <article>
            <h3>Basics</h3>
            <ol>
              {entry.shortRules.slice(0, 4).map((rule, index) => (
                <li key={rule}>
                  <strong>{index + 1}.</strong>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </article>
          <article>
            <h3>How it ends</h3>
            <ul>
              {entry.winConditions.slice(0, 3).map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </article>
        </div>
        <section className="catalog-rules-status" aria-label={`${displayGameName(entry)} status`}>
          <h3>Status</h3>
          <div className="catalog-card-meta">
            <span>{entry.board.description}</span>
            <span>{displayPiecePresentation(entry)}</span>
            <span>{displayRulesReadiness(entry)}</span>
            <span>{displayReleaseReadiness(entry)}</span>
            <span>{entry.botAdapter !== "none" ? displayBotReadiness(entry) : "Rules only"}</span>
          </div>
        </section>
      </section>
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
