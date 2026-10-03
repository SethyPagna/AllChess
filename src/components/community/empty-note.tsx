import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** One short line and at most one action; used by the watch, history, leaderboards and analysis pages. */
export function EmptyNote({ icon: Icon, title, text, children }: { icon?: LucideIcon; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="cm-empty">
      {Icon ? <Icon size={22} strokeWidth={1.75} aria-hidden="true" /> : null}
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
      {children}
    </div>
  );
}
