import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PieceIcon } from "@/components/piece-icon";

describe("PieceIcon", () => {
  test("renders visually distinct full-size western king and queen icons", () => {
    const king = renderToStaticMarkup(<PieceIcon code="k" owner="white" variantKey="classic" />);
    const queen = renderToStaticMarkup(<PieceIcon code="q" owner="white" variantKey="classic" />);

    expect(king).toContain('data-piece="king"');
    expect(queen).toContain('data-piece="queen"');
    expect(king).not.toBe(queen);
    expect(king).toContain("viewBox");
    expect(queen).toContain("viewBox");
  });

  test("keeps non-western pieces as strong native symbols", () => {
    const general = renderToStaticMarkup(<PieceIcon code="g" owner="red" variantKey="xiangqi" />);

    expect(general).toContain('data-piece="native"');
    expect(general).toContain("王");
  });
});
