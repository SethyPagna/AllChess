"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Bot, Filter, Play, Search } from "lucide-react";

import {
  displayBotReadiness,
  displayGameName,
  displayPiecePresentation,
  displayPlayabilityStatus,
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
      </div>
      <div className="catalog-count">{filtered.length} games</div>
      <div className="catalog-grid">
        {filtered.map((entry) => (
          <article key={entry.id} className="panel catalog-card">
            <div>
              <h2>{displayGameName(entry)}</h2>
              <p>{gameFamilies.find((item) => item.key === entry.family)?.label}</p>
            </div>
            <div className="catalog-card-meta">
              <span>{entry.board.description}</span>
              <span>{displayPiecePresentation(entry)}</span>
            </div>
            <ol>
              {entry.shortRules.slice(0, 3).map((rule, index) => (
                <li key={rule}>
                  <strong>{index + 1}.</strong>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
            <div className="catalog-card-actions">
              {entry.playability === "playable" && entry.variantKey ? (
                <Link href={`/${locale}/play/${entry.variantKey}`} className="action-primary focus-ring">
                  <Play size={16} />
                  Play
                </Link>
              ) : (
                <Link href={`/${locale}/games/${entry.id}` as never} className="action-secondary focus-ring">
                  <BookOpen size={16} />
                  Learn
                </Link>
              )}
              <span className="catalog-status" data-status={entry.playability}>
                {displayPlayabilityStatus(entry.playability)}
              </span>
              {entry.botAdapter !== "none" ? (
                <span className="catalog-engine">
                  <Bot size={14} />
                  {displayBotReadiness(entry)}
                </span>
              ) : (
                <span className="catalog-engine">{displayRulesReadiness(entry)}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}
