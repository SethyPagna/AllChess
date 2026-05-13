"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle({ labels }: { labels: Record<"light" | "dark" | "system", string> }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? labels.light : labels.dark;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme)}
      className="focus-ring action-secondary grid h-10 w-10 place-items-center text-[var(--muted)]"
    >
      <Icon aria-hidden="true" size={17} />
    </button>
  );
}
