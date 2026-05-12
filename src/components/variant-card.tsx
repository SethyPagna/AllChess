import Link from "next/link";

import type { LocaleCode } from "@/lib/i18n/locales";
import type { VariantDefinition } from "@/lib/variants";

export function VariantCard({
  locale,
  variant,
  name
}: {
  locale: LocaleCode;
  variant: VariantDefinition;
  name: string;
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
      <div className="flex flex-wrap gap-2 text-xs">
        {variant.supportsDrops ? <span className="rounded bg-[var(--surface-strong)] px-2 py-1">drops</span> : null}
        {variant.supportsPromotion ? <span className="rounded bg-[var(--surface-strong)] px-2 py-1">promotion</span> : null}
        {variant.supportsCheck ? <span className="rounded bg-[var(--surface-strong)] px-2 py-1">check</span> : null}
      </div>
      <Link
        href={`/${locale}/play/${variant.key}`}
        className="focus-ring rounded-md bg-[var(--accent)] px-4 py-3 text-center font-bold text-black"
      >
        Start
      </Link>
    </article>
  );
}
