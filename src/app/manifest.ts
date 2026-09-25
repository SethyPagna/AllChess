import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { id: "/", name: "AllChess — games around the world", short_name: "AllChess", description: "Chess, Ouk Chaktrang, Shogi and more. Play, personalize, and invite a friend.", start_url: "/en", scope: "/", display: "standalone", background_color: "#f6f4ed", theme_color: "#294c39", icons: [{ src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
