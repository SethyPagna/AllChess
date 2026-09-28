"use client";

import Link from "next/link";
import { useRef } from "react";
import { Check, ChevronDown } from "lucide-react";

import { closeDetails, useDismissableDetails } from "@/components/ui/use-dismissable-details";

type Scope = { id: string; label: string };

/** One menu of scope links replaces the old picker, submit button and "All rankings" list. */
export function LeaderboardScopeMenu({ current, locale, scopes }: { current: string; locale: string; scopes: Scope[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref);
  const options = [{ id: "all", label: "All scopes" }, ...scopes];
  const selected = options.find((option) => option.id === current) ?? options[0];

  return (
    <nav aria-label="Leaderboard filters">
      <details ref={ref} className="cm-menu">
        <summary className="focus-ring" aria-label={`Leaderboard scope: ${selected.label}`} title="Choose a leaderboard scope">
          <span>{selected.label}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className="popover cm-menu-panel">
          {options.map((option) => (
            <Link
              key={option.id}
              href={(option.id === "all" ? `/${locale}/leaderboards` : `/${locale}/leaderboards?scope=${encodeURIComponent(option.id)}`) as never}
              className="focus-ring"
              aria-current={option.id === selected.id ? true : undefined}
              onClick={() => closeDetails(ref)}
            >
              {option.label}
              {option.id === selected.id ? <Check size={15} aria-hidden="true" /> : null}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
