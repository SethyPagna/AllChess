import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PromotionChoiceCard } from "@/components/board/game-board";

describe("PromotionChoiceCard", () => {
  test("shows the promoted result and keep option explicitly", () => {
    const markup = renderToStaticMarkup(<PromotionChoiceCard onChoose={() => undefined} pieceLabel="Silver General" promotedPieceLabel="Promoted Silver General" />);

    expect(markup).toContain('aria-label="Silver General promotion choice"');
    expect(markup).toContain("Choose promotion");
    expect(markup).toContain("Promote to Promoted Silver General");
    expect(markup).toContain('aria-label="Keep Silver General"');
  });
});
