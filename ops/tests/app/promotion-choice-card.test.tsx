import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PromotionChoiceCard } from "@/components/board/game-board";

describe("PromotionChoiceCard", () => {
  test("shows the promoted result and keep option explicitly", () => {
    const markup = renderToStaticMarkup(<PromotionChoiceCard locale="en" onChoose={() => undefined} pieceCode="b" pieceLabel="Bishop" pieceOwner="sente" pieceSkin="default" promotedPieceLabel="Dragon Horse" variantKey="mini-shogi" />);

    expect(markup).toContain('aria-label="Bishop promotion choice"');
    expect(markup).toContain("Choose promotion");
    expect(markup).toContain('data-code="b"');
    expect(markup).toContain('data-skin="mini-wedge"');
    expect(markup).toContain('data-promoted="true"');
    expect(markup).toContain("Promote to Dragon Horse");
    expect(markup).toContain('aria-label="Keep Bishop"');
  });
});
