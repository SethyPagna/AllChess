import { NextResponse } from "next/server";

import { listBotModelManifests } from "@/lib/bot-training";

export function GET() {
  return NextResponse.json({
    storage: {
      manifests: "D1",
      largeArtifacts: "R2",
      note: "Runtime gameplay consumes legal cached knowledge first; full neural training artifacts stay outside the browser bundle."
    },
    models: listBotModelManifests()
  });
}
