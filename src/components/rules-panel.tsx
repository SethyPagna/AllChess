import type { VariantRuleSummary } from "@/lib/rules-atlas";

export function RulesPanel({ summary, compact = false }: { summary: VariantRuleSummary; compact?: boolean }) {
  return (
    <section className={`rules-panel panel grid gap-3 ${compact ? "p-3" : "p-4"}`} aria-label="Rules summary">
      <div className="flex items-center justify-between gap-3">
        <h2 className={compact ? "text-base font-black" : "text-xl font-black"}>Rules summary</h2>
        <span className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-xs font-bold text-[var(--muted)]">{summary.variantKey}</span>
      </div>
      <ol className="grid gap-2 text-sm text-[var(--muted)]">
        {summary.numberedBasics.map((rule) => (
          <li key={rule} className="grid grid-cols-[1.75rem_1fr] gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-[var(--surface-soft)] text-xs font-black text-[var(--foreground)]">{summary.numberedBasics.indexOf(rule) + 1}</span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-2 text-xs text-[var(--muted)]">
        <p>
          <strong className="text-[var(--foreground)]">Win:</strong> {summary.winConditions.join("; ")}
        </p>
        <p>
          <strong className="text-[var(--foreground)]">Draw:</strong> {summary.drawConditions.join("; ")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {summary.sourceLinks.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--muted)]">
            {source.name}
          </a>
        ))}
      </div>
    </section>
  );
}
