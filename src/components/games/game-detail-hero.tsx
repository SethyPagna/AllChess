import Link from "next/link";
import { BookOpen, Bot, Play } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { displayBotReadiness, displayGameName, displayPlayabilityStatus, displayRulesReadiness, type GameCatalogEntry, type GameFamilyKey } from "@/lib/catalog";
import { playGameHref } from "@/lib/routing/play-links";

type GameDetailHeroProps = {
  entry: GameCatalogEntry;
  family?: { key: GameFamilyKey; label: string; description: string };
  locale: string;
};

export function GameDetailHero({ entry, family, locale }: GameDetailHeroProps) {
  return (
    <div className="game-detail-hero panel">
      <div>
        <p className="inline-flex items-center gap-2">
          {family?.label}
          <InfoHint text={family?.description ?? "Game family and rule lineage."} />
        </p>
        <h1>{displayGameName(entry)}</h1>
        <div className="game-detail-tags">
          <span>{displayPlayabilityStatus(entry.playability)}</span>
          <span>{entry.board.description}</span>
          <span>{displayRulesReadiness(entry)}</span>
          <span>{displayBotReadiness(entry)}</span>
        </div>
      </div>
      {entry.playability === "playable" && entry.variantKey ? (
        <div className="game-detail-actions">
          <Link href={playGameHref(locale, entry.variantKey, { mode: "offline", time: "rapid" }) as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-3">
            <Play size={18} />
            Play
          </Link>
          <Link href={playGameHref(locale, entry.variantKey, { mode: "bot", time: "rapid" }) as never} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-3">
            <Bot size={18} />
            Bot Mode
          </Link>
        </div>
      ) : (
        <span className="action-secondary inline-flex items-center gap-2 px-4 py-3">
          <BookOpen size={18} />
          Rule guide
        </span>
      )}
    </div>
  );
}
