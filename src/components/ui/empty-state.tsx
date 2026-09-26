import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";

export function EmptyState({ icon: Icon, title, help, children, className = "" }: { icon: LucideIcon; title: string; help?: string; children?: ReactNode; className?: string }) {
  return <div className={`studio-empty-state ${className}`}>
    <div className="studio-empty-icon" aria-hidden="true"><Icon size={32} strokeWidth={1.5} /></div>
    <div className="studio-empty-title"><h2>{title}</h2>{help ? <InfoHint text={help} /> : null}</div>
    {children}
  </div>;
}
