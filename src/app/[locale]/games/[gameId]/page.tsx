import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Bot, ExternalLink, Play } from "lucide-react";

import { displayBotReadiness, displayGameName, displayPiecePresentation, displayPlayabilityStatus, displayRulesReadiness, gameFamilies, getGameCatalogEntry } from "@/lib/catalog";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function GameDetailPage({ params }: { params: Promise<{ locale: string; gameId: string }> }) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const entry = getGameCatalogEntry(decodeURIComponent(gameId));
  if (!entry) notFound();
  const family = gameFamilies.find((item) => item.key === entry.family);

  return (
    <section className="game-detail">
      <Link href={`/${locale}/variants`} className="action-secondary focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm">
        <ArrowLeft size={16} />
        Games & rules
      </Link>
      <div className="game-detail-hero panel">
        <div>
          <p>{family?.label}</p>
          <h1>{displayGameName(entry)}</h1>
          <div className="game-detail-tags">
            <span>{displayPlayabilityStatus(entry.playability)}</span>
            <span>{entry.board.description}</span>
            <span>{displayPiecePresentation(entry)}</span>
          </div>
        </div>
        {entry.playability === "playable" && entry.variantKey ? (
          <div className="game-detail-actions">
            <Link href={`/${locale}/play/${entry.variantKey}` as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-3">
              <Play size={18} />
              Play
            </Link>
            <Link href={`/${locale}/play/${entry.variantKey}?bot=normal&mode=bot` as never} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-3">
              <Bot size={18} />
              Practice
            </Link>
          </div>
        ) : (
          <span className="action-secondary inline-flex items-center gap-2 px-4 py-3">
            <BookOpen size={18} />
            Rule guide
          </span>
        )}
      </div>
      <div className="game-detail-grid">
        <article className="panel game-detail-section">
          <h2>Basic rules</h2>
          <ol>
            {entry.shortRules.map((rule, index) => (
              <li key={rule}>
                <strong>{index + 1}.</strong>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="panel game-detail-section">
          <h2>How it ends</h2>
          <ul>
            {entry.winConditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </article>
        <article className="panel game-detail-section">
          <h2>Practice focus</h2>
          <p className="game-detail-note">
            {displayRulesReadiness(entry)} / {displayBotReadiness(entry)}
          </p>
          <ul>
            {entry.reviewFocus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="panel game-detail-section">
          <h2>Sources</h2>
          <ul>
            {entry.ruleSourceLinks.map((source) => (
              <li key={source.url}>
                <a className="focus-ring inline-flex items-center gap-2" href={source.url} rel="noreferrer" target="_blank">
                  {source.name}
                  <ExternalLink size={14} />
                </a>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
