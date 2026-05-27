import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AllChess Multiplayer",
  description: "A multilingual multiplayer chess platform for global variants."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
