import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "coverage/**",
      "legacy/**",
      "node_modules/**",
      "playwright-report/**",
      "public/engines/stockfish/**",
      "test-results/**"
    ]
  }
];

export default eslintConfig;
