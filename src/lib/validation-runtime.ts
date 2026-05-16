export type ValidationRuntimeProfile = {
  browserAutomation: {
    preferred: "in-app-browser-plugin";
    status: "unavailable";
    missingClient: "scripts/browser-client.mjs";
    fallback: "playwright-plus-live-http-smoke";
    note: string;
  };
  activeValidation: Array<{
    tool: "Playwright" | "HTTP smoke";
    status: "active";
    scope: string;
  }>;
  releaseGate: {
    policy: "pass-fallback-validation-when-browser-plugin-unavailable";
    requiredSignals: string[];
  };
};

export function getValidationRuntimeProfile(): ValidationRuntimeProfile {
  return {
    browserAutomation: {
      preferred: "in-app-browser-plugin",
      status: "unavailable",
      missingClient: "scripts/browser-client.mjs",
      fallback: "playwright-plus-live-http-smoke",
      note:
        "The in-app browser automation plugin is present in the local tool list, but its browser client file is missing from the plugin cache. AllChess therefore treats Playwright E2E plus live HTTP smoke as the active validation path until that plugin cache is repaired."
    },
    activeValidation: [
      {
        tool: "Playwright",
        status: "active",
        scope: "Desktop/mobile E2E, board stability, bot controls, result/review flow, and console-surface checks."
      },
      {
        tool: "HTTP smoke",
        status: "active",
        scope: "Deployed Cloudflare pages and API endpoints return successful responses after each deploy."
      }
    ],
    releaseGate: {
      policy: "pass-fallback-validation-when-browser-plugin-unavailable",
      requiredSignals: ["lint", "typecheck", "unit tests", "production build", "Playwright E2E where UI changes are touched", "live HTTP smoke"]
    }
  };
}
