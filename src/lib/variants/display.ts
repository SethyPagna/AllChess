import type { VariantDefinition } from "@/lib/variants/types";

export function formatVariantPlayMeta(variant: Pick<VariantDefinition, "engineProtocol">) {
  const engineLabel = variant.engineProtocol === "internal" ? "AllChess bot" : "Engine-assisted bot";
  return `Rules checked / ${engineLabel}`;
}
