import type { VariantRuleSummary } from "@/lib/variants/rules-atlas";

type GameGuideModalProps = {
  onClose: () => void;
  rulesSummary?: VariantRuleSummary;
  show: boolean;
};

export function GameGuideModal({ onClose, rulesSummary, show }: GameGuideModalProps) {
  if (!show || !rulesSummary) return null;

  return (
    <div className="rules-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="rules-modal panel" role="dialog" aria-label="Game guide" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Game guide</p>
            <h2>{rulesSummary.variantKey}</h2>
          </div>
          <button type="button" title="Close guide" onClick={onClose} className="focus-ring action-secondary px-3 py-2 text-sm">
            Close
          </button>
        </div>
        <div className="catalog-guide-sections">
          <details open>
            <summary>Basics</summary>
            <ol className="rules-numbered-list">
              {rulesSummary.numberedBasics.map((rule, index) => (
                <li key={rule}>
                  <span>{index + 1}</span>
                  <p>{rule}</p>
                </li>
              ))}
            </ol>
          </details>
          <details>
            <summary>How it ends</summary>
            <div className="rules-modal-grid">
              <p>
                <strong>Win:</strong> {rulesSummary.winConditions.join("; ")}
              </p>
              <p>
                <strong>Draw:</strong> {rulesSummary.drawConditions.join("; ")}
              </p>
              <p>
                <strong>Illegal:</strong> {rulesSummary.illegalMoveNotes.join("; ")}
              </p>
            </div>
          </details>
          <details>
            <summary>Sources</summary>
            <div className="flex flex-wrap gap-2">
              {rulesSummary.sourceLinks.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--muted)]">
                  {source.name}
                </a>
              ))}
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
