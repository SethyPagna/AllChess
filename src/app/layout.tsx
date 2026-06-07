import type { Metadata } from "next";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "AllChess Multiplayer",
  description: "A multilingual multiplayer chess platform for global variants.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
