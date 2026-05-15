import { Info } from "lucide-react";

export function InfoHint({ label = "More information", text }: { label?: string; text: string }) {
  return (
    <span className="info-hint" tabIndex={0}>
      <span className="info-hint-trigger" aria-label={label} role="button">
        <Info aria-hidden="true" size={14} />
      </span>
      <span className="info-hint-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
