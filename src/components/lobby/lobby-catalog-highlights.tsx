import Link from "next/link";
import { BarChart3, Radio, Swords } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { displayGameName, displayRulesReadiness, gameFamilies, type CatalogStats, type GameCatalogEntry } from "@/lib/catalog";
import { playGameHref } from "@/lib/routing/play-links";

type LobbyStatsProps = {
  stats: CatalogStats;
};

type FeaturedGamesProps = {
  entries: GameCatalogEntry[];
  locale: string;
};

type FamilyHighlightsProps = {
  locale: string;
  stats: CatalogStats;
};

export function LobbyCatalogStats({ stats }: LobbyStatsProps) {
  return (
    <div className="lobby-stat-grid">
      <div className="panel lobby-stat-card" role="group" aria-label={`${stats.totalGames} games and rules`}>
        <BarChart3 size={18} aria-hidden="true" />
        <strong>{stats.totalGames}</strong>
        <span>games & rules</span>
      </div>
      <div className="panel lobby-stat-card" role="group" aria-label={`${stats.playableGames} playable games`}>
        <Swords size={18} aria-hidden="true" />
        <strong>{stats.playableGames}</strong>
        <span>playable now</span>
      </div>
      <div className="panel lobby-stat-card" role="group" aria-label={`${stats.learnGames + stats.comingSoonGames} guides and drafts`}>
        <Radio size={18} aria-hidden="true" />
        <strong>{stats.learnGames + stats.comingSoonGames}</strong>
        <span>guides & drafts</span>
      </div>
    </div>
  );
}

export function LobbyFeaturedGames({ entries, locale }: FeaturedGamesProps) {
  return (
    <section className="lobby-section-card">
      <div className="compact-section-heading">
        <h2 className="section-title">Play Now</h2>
        <InfoHint text="Playable boards, grouped tightly so the lobby reads at a glance." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => {
          const gameName = displayGameName(entry);
          const readiness = displayRulesReadiness(entry);
          const winCondition = entry.winConditions[0];

          return (
            <Link key={entry.id} href={playGameHref(locale, entry.variantKey, { mode: "offline", time: "rapid" }) as never} className="panel lobby-featured-card focus-ring" aria-label={`${gameName}. ${readiness}. ${winCondition}.`}>
              <span className="lobby-featured-head">
                <strong>{gameName}</strong>
                <span>{readiness}</span>
              </span>
              <span className="lobby-featured-body">{winCondition}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function LobbyFamilyHighlights({ locale, stats }: FamilyHighlightsProps) {
  const familyHighlights = gameFamilies.slice(0, 6);

  return (
    <section className="lobby-section-card">
      <div className="compact-section-heading">
        <h2 className="section-title">Games & Rules</h2>
        <InfoHint text="Browse related games together, then open a short rule guide or a verified board." />
      </div>
      <div className="panel lobby-family-strip">
        {familyHighlights.map((family) => {
          const gameCount = stats.familyCounts[family.key];

          return (
            <Link key={family.key} href={`/${locale}/variants?family=${family.key}`} className="focus-ring" aria-label={`${family.label}. ${gameCount} games.`}>
              <strong>{family.label}</strong>
              <span>{gameCount} games</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
