import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  devIndicators: false,
  output: "standalone",
  typedRoutes: true,
  async redirects() {
    return [
      { source: "/chess", destination: "/en", permanent: false },
      { source: "/learn", destination: "/en/variants", permanent: false },
      { source: "/games", destination: "/en/variants", permanent: false },
      { source: "/rules", destination: "/en/variants", permanent: false },
      { source: "/play", destination: "/en/play", permanent: false },
      { source: "/watch", destination: "/en/watch", permanent: false },
      { source: "/leaderboards", destination: "/en/leaderboards", permanent: false },
      { source: "/history", destination: "/en/history", permanent: false },
      { source: "/settings", destination: "/en/settings", permanent: false },
      { source: "/login", destination: "/en/login", permanent: false },
      { source: "/profile", destination: "/en/profile/player", permanent: false }
    ];
  },
  turbopack: {
    root
  }
};

export default nextConfig;
