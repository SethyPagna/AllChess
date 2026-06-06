import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PromotionChoiceCard } from "@/components/board/game-board";

describe("PromotionChoiceCard", () => {
  test("shows the promoted result and keep option explicitly", () => {
    const markup = renderToStaticMarkup(<PromotionChoiceCard locale="en" onChoose={() => undefined} pieceCode="s" pieceLabel="Silver General" pieceOwner="sente" pieceSkin="default" promotedPieceLabel="Promoted Silver General" variantKey="mini-shogi" />);

    expect(markup).toContain('aria-label="Silver General promotion choice"');
    expect(markup).toContain("Choose promotion");
    expect(markup).toContain('data-code="s"');
    expect(markup).toContain('data-skin="mini-wedge"');
    expect(markup).toContain('data-promoted="true"');
    expect(markup).toContain("Promote to Promoted Silver General");
    expect(markup).toContain('aria-label="Keep Silver General"');
  });
});
