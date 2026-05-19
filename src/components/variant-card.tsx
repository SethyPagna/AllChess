import Link from "next/link";

import type { LocaleCode } from "@/lib/i18n/locales";
import { playGameHref } from "@/lib/routing/play-links";
import type { VariantRuleSummary } from "@/lib/rules-atlas";
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
    <article className="panel grid gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">{name}</h3>
          <p className="text-sm capitalize text-[var(--muted)]">{variant.family.replace("-", " ")}</p>
        </div>
        <span className="rounded-md bg-[var(--surface-strong)] px-2 py-1 font-mono text-xs">
          {variant.board.rows}x{variant.board.cols}
        </span>
      </div>
      <p className="min-h-12 text-sm leading-6 text-[var(--muted)]">{variant.objective}</p>
      {ruleSummary ? (
        <ol className="grid gap-1 text-xs text-[var(--muted)]">
          {ruleSummary.numberedBasics.slice(0, 2).map((rule, index) => (
            <li key={rule} className="flex gap-2">
              <span className="font-black text-[var(--foreground)]">{index + 1}.</span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs">
        {variant.supportsDrops ? <span className="rounded bg-[var(--surface-strong)] px-2 py-1">drops</span> : null}
        {variant.supportsPromotion ? <span className="rounded bg-[var(--surface-strong)] px-2 py-1">promotion</span> : null}
        {variant.supportsCheck ? <span className="rounded bg-[var(--surface-strong)] px-2 py-1">check</span> : null}
      </div>
      <Link
        href={playGameHref(locale, variant.key, { mode: "offline", time: "rapid" }) as never}
        className="focus-ring rounded-md bg-[var(--accent)] px-4 py-3 text-center font-bold text-black"
      >
        Start
      </Link>
    </article>
  );
}
