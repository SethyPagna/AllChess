import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Bot, ExternalLink, Play } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { displayBotReadiness, displayGameName, displayPiecePresentation, displayPlayabilityStatus, displayRulesReadiness, gameFamilies, getGameCatalogEntry } from "@/lib/catalog";
import { listBotTrainingReadiness } from "@/lib/bot/training";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVariantRuleSummary } from "@/lib/rules-atlas";

export default async function GameDetailPage({ params }: { params: Promise<{ locale: string; gameId: string }> }) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const entry = getGameCatalogEntry(decodeURIComponent(gameId));
  if (!entry) notFound();
  const family = gameFamilies.find((item) => item.key === entry.family);
  const completion = entry.variantKey ? getVariantRuleSummary(entry.variantKey).completion : null;
  const readiness = entry.variantKey ? listBotTrainingReadiness(entry.variantKey)[0] : null;
  const isGated = completion?.status !== "verified-playable" || readiness?.coverageStatus === "rules-gated";

  return (
    <section className="game-detail">
      <Link href={`/${locale}/variants`} className="action-secondary focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm">
        <ArrowLeft size={16} />
        Games & rules
      </Link>
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
            <Link href={`/${locale}/play/${entry.variantKey}` as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-3">
              <Play size={18} />
              Play
            </Link>
            <Link href={`/${locale}/play/${entry.variantKey}?bot=normal&mode=bot` as never} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-3">
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
      {isGated ? (
        <div className="game-detail-gate panel" aria-label="Training and rules gate">
          <div>
            <strong>Guide gated for play</strong>
            <span>
              This game stays as a rule guide until native rules, legal bot moves, review, persistence, and E2E fixtures are complete.
            </span>
          </div>
          <span>{readiness?.primaryGap ?? completion?.remainingGates[0] ?? "Complete the verification matrix before enabling play."}</span>
        </div>
      ) : null}
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
          <h2>Training focus</h2>
          <div className="game-detail-note">
            <span>{displayPiecePresentation(entry)}</span>
            <span>{displayBotReadiness(entry)}</span>
          </div>
          <ul>
            {entry.reviewFocus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        {completion ? (
          <article className="panel game-detail-section">
            <h2>{completion.status === "verified-playable" ? "Verified rules" : "Rules gate"}</h2>
            <ul>
              {(completion.status === "verified-playable" ? completion.verifiedEdgeCases : completion.remainingGates).slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ) : null}
        <article className="panel game-detail-section">
          <div className="game-detail-source-head">
            <h2>Sources</h2>
            <InfoHint text="Rule guides stay linked here so playable games can be checked against credible references." />
          </div>
          <ul>
            {entry.ruleSourceLinks.slice(0, 3).map((source) => (
              <li key={source.url}>
                <a className="focus-ring inline-flex items-center gap-2" href={source.url} rel="noreferrer" target="_blank">
                  {source.name}
                  <ExternalLink size={14} />
                </a>
              </li>
            ))}
          </ul>
          {entry.ruleSourceLinks.length > 3 ? <p className="game-detail-source-more">+{entry.ruleSourceLinks.length - 3} more references kept in the catalog record.</p> : null}
        </article>
      </div>
    </section>
  );
}
