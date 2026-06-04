import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PieceIcon } from "@/components/board/piece-icon";

describe("PieceIcon", () => {
  test("renders visually distinct full-size western king and queen icons", () => {
    const king = renderToStaticMarkup(<PieceIcon code="k" owner="white" variantKey="classic" />);
    const queen = renderToStaticMarkup(<PieceIcon code="q" owner="white" variantKey="classic" />);

    expect(king).toContain('data-piece="king"');
    expect(queen).toContain('data-piece="queen"');
    expect(king).not.toBe(queen);
    expect(king).toContain("viewBox");
    expect(queen).toContain("viewBox");
    expect(king).toContain('data-detail="king-cross"');
    expect(queen).toContain('data-detail="queen-jewel"');
  });

  test("renders Makruk met as the queen-style piece", () => {
    const met = renderToStaticMarkup(<PieceIcon code="m" owner="white" variantKey="makruk" />);

    expect(met).toContain('data-piece="queen"');
    expect(met).toContain('data-detail="queen-jewel"');
  });

  test("renders draughts men and kings as checker discs", () => {
    const man = renderToStaticMarkup(<PieceIcon code="p" owner="white" variantKey="english-draughts" />);
    const king = renderToStaticMarkup(<PieceIcon code="x" owner="white" variantKey="english-draughts" promoted />);
    const internationalKing = renderToStaticMarkup(<PieceIcon code="x" owner="white" variantKey="international-draughts" promoted />);
    const turkishKing = renderToStaticMarkup(<PieceIcon code="x" owner="white" variantKey="turkish-draughts" promoted />);

    expect(man).toContain('data-piece="checker-man"');
    expect(king).toContain('data-piece="checker-king"');
    expect(internationalKing).toContain('data-piece="checker-king"');
    expect(turkishKing).toContain('data-piece="checker-king"');
    expect(king).toContain('data-detail="checker-crown"');
    expect(man).not.toContain(">P<");
    expect(king).not.toContain(">X<");
  });

  test("keeps non-western pieces as strong native symbols", () => {
    const redGeneral = renderToStaticMarkup(<PieceIcon code="g" owner="red" variantKey="xiangqi" />);
    const blackGeneral = renderToStaticMarkup(<PieceIcon code="g" owner="black" variantKey="xiangqi" />);
    const shogiPawn = renderToStaticMarkup(<PieceIcon code="p" owner="sente" variantKey="shogi" />);
    const jungleRat = renderToStaticMarkup(<PieceIcon code="r" owner="white" variantKey="jungle" />);

    expect(redGeneral).toContain('data-piece="native"');
    expect(redGeneral).toContain("帥");
    expect(blackGeneral).toContain("將");
    expect(shogiPawn).toContain("歩");
    expect(jungleRat).toContain("鼠");
  });
});
