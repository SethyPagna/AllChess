import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    testTimeout: 15_000
  },
  resolve: {
    alias: {
      "@": new URL("../../src", import.meta.url).pathname
    }
  }
});
