import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["ops/tests/**/*.test.ts", "ops/tests/**/*.test.tsx"],
    globals: true,
    testTimeout: 15_000
  },
  resolve: {
    alias: {
      "@": new URL("../../src", import.meta.url).pathname
    }
  }
});
