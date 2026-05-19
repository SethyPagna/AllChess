import { useId } from "react";
import { Info } from "lucide-react";

export function InfoHint({ label = "More information", text }: { label?: string; text: string }) {
  const tooltipId = useId();

  return (
    <span className="info-hint">
      <span className="info-hint-trigger" aria-describedby={tooltipId} aria-label={label} role="button" tabIndex={0}>
        <Info aria-hidden="true" size={14} />
      </span>
      <span className="info-hint-bubble" id={tooltipId} role="tooltip">
        {text}
      </span>
    </span>
  );
}
