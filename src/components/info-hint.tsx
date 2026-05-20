import { useId } from "react";
import { Info } from "lucide-react";

export function InfoHint({ label = "More information", text }: { label?: string; text: string }) {
  const tooltipId = useId();

  return (
    <details className="info-hint">
      <summary className="info-hint-trigger" aria-controls={tooltipId} aria-label={label}>
        <Info aria-hidden="true" size={14} />
      </summary>
      <span className="info-hint-bubble" id={tooltipId} role="tooltip">
        {text}
      </span>
    </details>
  );
}
