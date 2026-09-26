"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/shell/theme-provider";

export function ThemeChoices({ labels }: { labels: Record<"light" | "dark" | "system", string> }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className="settings-theme-options" role="group" aria-label="Display appearance">
    {([{ key: "light", Icon: Sun }, { key: "dark", Icon: Moon }, { key: "system", Icon: Monitor }] as const).map(({ key, Icon }) => <button key={key} type="button" className="focus-ring" aria-pressed={mounted && theme === key} onClick={() => setTheme(key)}><Icon size={18} aria-hidden="true" /><span>{labels[key]}</span></button>)}
  </div>;
}
