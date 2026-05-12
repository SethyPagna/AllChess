"use client";

import { Moon, Monitor, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const modes = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor }
] as const;

export function ThemeToggle({ labels }: { labels: Record<"light" | "dark" | "system", string> }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-grid grid-cols-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
      {modes.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={labels[value]}
          title={labels[value]}
          onClick={() => setTheme(value)}
          className={cn(
            "focus-ring grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] transition",
            theme === value && "bg-[var(--accent)] text-black shadow-sm"
          )}
        >
          <Icon aria-hidden="true" size={16} />
        </button>
      ))}
    </div>
  );
}
