import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PromotionChoiceCard, type PromotionOption } from "@/components/board/game-board";

const move = { from: { row: 1, col: 0 }, to: { row: 0, col: 0 }, promotion: true };

describe("PromotionChoiceCard", () => {
  test("shows the promoted result and keep option explicitly", () => {
    const options: PromotionOption[] = [
      { move, code: "b", promoted: true, label: "Promote to Dragon Horse", actionLabel: "Promote to Dragon Horse" },
      { move: { ...move, promotion: false }, code: "b", promoted: false, label: "Keep Bishop", actionLabel: "Keep Bishop" }
    ];
    const markup = renderToStaticMarkup(<PromotionChoiceCard locale="en" onChoose={() => undefined} options={options} pieceLabel="Bishop" pieceOwner="sente" pieceSkin="default" variantKey="mini-shogi" />);

    expect(markup).toContain('aria-label="Bishop promotion choice"');
    expect(markup).toContain("Choose promotion");
    expect(markup).toContain('data-code="b"');
    expect(markup).toContain('data-skin="mini-wedge"');
    expect(markup).toContain('data-promoted="true"');
    expect(markup).toContain("Promote to Dragon Horse");
    expect(markup).toContain('aria-label="Keep Bishop"');
  });

  test("offers every Western promotion piece, queen first", () => {
    const options: PromotionOption[] = ["q", "r", "b", "n"].map((code) => {
      const label = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[code]!;
      return { move: { ...move, promoteTo: code }, code, promoted: false, label, actionLabel: `Promote to ${label}` };
    });
    const markup = renderToStaticMarkup(<PromotionChoiceCard locale="en" onChoose={() => undefined} options={options} pieceLabel="Pawn" pieceOwner="white" pieceSkin="default" variantKey="classic" />);

    expect(markup).toContain('data-count="4"');
    expect(markup.indexOf("Promote to Queen")).toBeLessThan(markup.indexOf("Promote to Knight"));
    for (const code of ["q", "r", "b", "n"]) expect(markup).toContain(`data-code="${code}"`);
    expect(markup).not.toContain('data-promoted="true"');
  });
});
