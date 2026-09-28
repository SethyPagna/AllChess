"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { useTheme } from "@/components/shell/theme-provider";

/** The icon follows the `.dark` class that the init script sets before paint, so it is right before hydration. */
export function ThemeToggle({ labels }: { labels: Record<"light" | "dark" | "system", string> }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const label = mounted && resolvedTheme === "dark" ? labels.light : labels.dark;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
      className="icon-btn shell-icon-control focus-ring"
    >
      <Sun aria-hidden="true" size={16} className="theme-icon-sun" />
      <Moon aria-hidden="true" size={16} className="theme-icon-moon" />
    </button>
  );
}
