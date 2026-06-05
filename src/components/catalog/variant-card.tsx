import Link from "next/link";

import type { LocaleCode } from "@/lib/i18n/locales";
import { playGameHref } from "@/lib/routing/play-links";
import type { VariantRuleSummary } from "@/lib/variants/rules-atlas";
import type { VariantDefinition } from "@/lib/variants";

export function VariantCard({
  locale,
  variant,
  name,
  ruleSummary
}: {
  locale: LocaleCode;
  variant: VariantDefinition;
  name: string;
  ruleSummary?: VariantRuleSummary;
}) {
  return (
    <article className="variant-card panel">
      <div className="variant-card-head">
        <div>
          <h3>{name}</h3>
          <p>{variant.family.replace("-", " ")}</p>
        </div>
        <span className="variant-board-size">
          {variant.board.rows}x{variant.board.cols}
        </span>
      </div>
      <p className="variant-card-objective">{variant.objective}</p>
      {ruleSummary ? (
        <ol className="variant-rule-preview">
          {ruleSummary.numberedBasics.slice(0, 2).map((rule, index) => (
            <li key={rule}>
              <strong>{index + 1}.</strong>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="variant-feature-list">
        {variant.supportsDrops ? <span>drops</span> : null}
        {variant.supportsPromotion ? <span>promotion</span> : null}
        {variant.supportsCheck ? <span>check</span> : null}
      </div>
      <Link href={playGameHref(locale, variant.key, { mode: "offline", time: "rapid" }) as never} className="variant-start-link action-primary focus-ring">
        Start
      </Link>
    </article>
  );
}
