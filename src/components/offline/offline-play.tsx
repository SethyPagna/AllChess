"use client";

import { useEffect, useState } from "react";
import { Crown, WifiOff } from "lucide-react";
import { GameBoard } from "@/components/board/game-board";
import { SavedMatches } from "@/components/board/saved-matches";
import { OfflinePack } from "@/components/shell/offline-pack";
import { gameCatalog, getCatalogModeSupport } from "@/lib/catalog";
import { normalizeLocale, rtlLocales } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/dictionary";
import { getVariant } from "@/lib/variants";
import { getVariantRuleSummary } from "@/lib/variants/rules-atlas";
import { parseBotDifficulty, parseTimeControl } from "@/lib/routing/params";

export function OfflinePlay() {
  const [query, setQuery] = useState<URLSearchParams | null>(null);
  useEffect(() => { queueMicrotask(() => setQuery(new URLSearchParams(window.location.search))); }, []);
  const locale = normalizeLocale(query?.get("locale") ?? "en");
  const entry = gameCatalog.find(game => game.variantKey === query?.get("game") && getCatalogModeSupport(game, "offline").enabled)
    ?? gameCatalog.find(game => game.variantKey === "classic")!;
  const mode = query?.get("mode") === "bot" && getCatalogModeSupport(entry, "bot").enabled ? "bot" : "offline";
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = rtlLocales.has(locale) ? "rtl" : "ltr";
  }, [locale]);
  return <main className="offline-play">
    <header className="offline-play-header">
      <a href={`/${locale}`} className="app-brand focus-ring" aria-label="AllChess online home"><span className="app-brand-mark"><Crown size={22} /></span><strong>AllChess</strong></a>
      <span className="offline-play-label"><WifiOff size={16} /> Offline play</span>
      <OfflinePack />
    </header>
    <p className="offline-play-note">Local and bot games on this device. Connect to the internet for friend rooms and accounts.</p>
    <SavedMatches locale={locale} offline />
    {query ? <section className="play-arena"><div className="play-core grid gap-3"><GameBoard
      key={entry.variantKey} variantKey={entry.variantKey!} locale={locale} title={createTranslator(locale)(getVariant(entry.variantKey!).nameKey)}
      rulesSummary={getVariantRuleSummary(entry.variantKey!)} localOnly
      initialSavedMatchId={query.get("resume") ?? undefined}
      initialPlayMode={mode} initialBotMode={mode === "bot" ? "opponent" : "human"}
      initialBotDifficulty={parseBotDifficulty(query.get("bot") ?? undefined)}
      initialTimeControl={parseTimeControl(query.get("time") ?? undefined) ?? "freestyle"}
    /></div></section> : <p role="status">Opening your board…</p>}
  </main>;
}
