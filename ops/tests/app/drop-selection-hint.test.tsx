import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { DropSelectionHint } from "@/components/board/game-board";

describe("DropSelectionHint", () => {
  test("summarizes selected hand drops with a legal-square count", () => {
    const markup = renderToStaticMarkup(<DropSelectionHint legalTargetCount={7} onCancel={() => undefined} pieceLabel="Gold" />);

    expect(markup).toContain('aria-label="Dropping Gold"');
    expect(markup).toContain("Drop Gold");
    expect(markup).toContain("7 legal squares");
    expect(markup).toContain('aria-label="Cancel Gold drop"');
  });

  test("handles blocked hand drops without hiding the cancel action", () => {
    const markup = renderToStaticMarkup(<DropSelectionHint legalTargetCount={0} onCancel={() => undefined} pieceLabel="Pawn" />);

    expect(markup).toContain("No legal squares");
    expect(markup).toContain("Cancel");
  });
});
