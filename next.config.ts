import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  typedRoutes: true,
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
