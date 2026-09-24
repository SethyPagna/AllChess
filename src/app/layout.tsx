import type { Metadata, Viewport } from "next";

import "@/styles/globals.css";
import "@/styles/studio.css";

export const metadata: Metadata = {
  title: "AllChess Multiplayer",
  description: "A multilingual multiplayer chess platform for global variants.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/app-192.png", type: "image/png" }]
  },
  appleWebApp: { capable: true, title: "AllChess", statusBarStyle: "default" }
};

export const viewport: Viewport = { themeColor: "#294c39" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
