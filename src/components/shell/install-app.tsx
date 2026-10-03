"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    function ready(event: Event) { event.preventDefault(); setPrompt(event as InstallEvent); }
    function installed() { setPrompt(null); }
    window.addEventListener("beforeinstallprompt", ready); window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", ready); window.removeEventListener("appinstalled", installed); };
  }, []);
  if (!prompt) return null;
  return <button type="button" className="focus-ring action-secondary" aria-label="Install AllChess" title="Install AllChess" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}><Download size={18} /><span className="sr-only">Install AllChess</span></button>;
}
