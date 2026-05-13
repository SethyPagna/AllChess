"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";

import type { VariantRuleSummary } from "@/lib/rules-atlas";

export function RulesSummaryButton({ summary }: { summary: VariantRuleSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm" aria-label="Rules summary">
        <BookOpen size={16} />
        Rules
      </button>
      {open ? (
        <div className="rules-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section className="rules-modal panel" role="dialog" aria-label="Basic rules" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Basic rules</p>
                <h2>{summary.variantKey}</h2>
              </div>
              <button type="button" title="Close rules" onClick={() => setOpen(false)} className="focus-ring action-secondary px-3 py-2 text-sm">
                Close
              </button>
            </div>
            <ol className="rules-numbered-list">
              {summary.numberedBasics.map((rule, index) => (
                <li key={rule}>
                  <span>{index + 1}</span>
                  <p>{rule}</p>
                </li>
              ))}
            </ol>
            <div className="rules-modal-grid">
              <p>
                <strong>Win:</strong> {summary.winConditions.join("; ")}
              </p>
              <p>
                <strong>Draw:</strong> {summary.drawConditions.join("; ")}
              </p>
              <p>
                <strong>Illegal:</strong> {summary.illegalMoveNotes.join("; ")}
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
        </div>
      ) : null}
    </>
  );
}
