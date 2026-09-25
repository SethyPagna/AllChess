import type { Metadata } from "next";
import { OfflinePlay } from "@/components/offline/offline-play";
import { ThemeProvider } from "@/components/shell/theme-provider";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "AllChess · Offline play", robots: { index: false, follow: false } };

// A public shell with no account, room, cookie, or server-provided player data.
export default function OfflinePage() {
  return <html lang="en"><body><ThemeProvider><OfflinePlay /></ThemeProvider></body></html>;
}
