import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    reactCompiler: true
  }
};

export default nextConfig;
