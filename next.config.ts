import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
