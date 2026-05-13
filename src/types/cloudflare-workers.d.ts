declare module "cloudflare:workers" {
  import type { DurableObjectState } from "@cloudflare/workers-types";

  export abstract class DurableObject {
    protected ctx: DurableObjectState;
    protected env: unknown;
    constructor(ctx: DurableObjectState, env: unknown);
    fetch?(request: Request): Response | Promise<Response>;
  }
}
