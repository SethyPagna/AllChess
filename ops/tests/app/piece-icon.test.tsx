import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BoardPlayerCard } from "@/components/board/board-player-card";
import { PieceIcon, getPieceSkinOptions } from "@/components/board/piece-icon";

describe("PieceIcon", () => {
  test("renders visually distinct full-size western king and queen icons", () => {
    const king = renderToStaticMarkup(<PieceIcon code="k" owner="white" variantKey="classic" />);
    const queen = renderToStaticMarkup(<PieceIcon code="q" owner="white" variantKey="classic" />);

    expect(king).toContain('data-piece="king"');
    expect(queen).toContain('data-piece="queen"');
    expect(king).not.toBe(queen);
    expect(king).toContain("viewBox");
    expect(queen).toContain("viewBox");
    expect(king).toContain('data-piece-label="King"');
    expect(king).toContain('data-skin="western"');
    expect(king).toContain('data-detail="king-cross"');
    expect(queen).toContain('data-detail="queen-jewel"');
  });

  test("renders Makruk met as the queen-style piece", () => {
    const met = renderToStaticMarkup(<PieceIcon code="m" owner="white" variantKey="makruk" />);

    expect(met).toContain('data-piece="queen"');
    expect(met).toContain('data-skin="makruk"');
    expect(met).toContain('data-detail="queen-jewel"');
    expect(met).toContain("<title>Met</title>");
  });

  test("localizes piece titles for language-specific board labels", () => {
    const shogiPawn = renderToStaticMarkup(<PieceIcon code="p" owner="sente" variantKey="shogi" locale="ja" />);
    const miniShogiPawn = renderToStaticMarkup(<PieceIcon code="p" owner="sente" variantKey="mini-shogi" locale="ja" />);
    const chineseKing = renderToStaticMarkup(<PieceIcon code="k" owner="white" variantKey="classic" locale="zh-CN" />);

    expect(shogiPawn).toContain('aria-label="歩"');
    expect(shogiPawn).toContain('title="歩"');
    expect(miniShogiPawn).toContain('data-variant="mini-shogi"');
    expect(miniShogiPawn).toContain('data-skin="mini-wedge"');
    expect(miniShogiPawn).toContain("\u6b69");
    expect(chineseKing).toContain("<title>王</title>");
  });

  test("offers and applies alternate piece skins per variant family", () => {
    const shogiSkins = getPieceSkinOptions("shogi").map((option) => option.key);
    const shogiTile = renderToStaticMarkup(<PieceIcon code="p" owner="sente" pieceSkin="tile" variantKey="shogi" />);
    const westernWarm = renderToStaticMarkup(<PieceIcon code="k" owner="white" pieceSkin="makruk" variantKey="classic" />);

    expect(shogiSkins).toEqual(expect.arrayContaining(["default", "wedge", "mini-wedge", "tile"]));
    expect(shogiTile).toContain('data-skin="tile"');
    expect(shogiTile).toContain("\u6b69");
    expect(westernWarm).toContain('data-skin="makruk"');
  });

  test("adds localized piece metadata to SVG and native pieces", () => {
    const japanesePawnName = "\u6b69";
    const chineseKingName = "\u738b";
    const shogiPawn = renderToStaticMarkup(<PieceIcon code="p" owner="sente" variantKey="shogi" locale="ja" />);
    const chineseKing = renderToStaticMarkup(<PieceIcon code="k" owner="white" variantKey="classic" locale="zh-CN" />);

    expect(shogiPawn).toContain(`title="${japanesePawnName}"`);
    expect(shogiPawn).toContain(`data-piece-label="${japanesePawnName}"`);
    expect(chineseKing).toContain(`<title>${chineseKingName}</title>`);
    expect(chineseKing).toContain(`data-piece-label="${chineseKingName}"`);
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

  test("renders konane pieces as stone discs", () => {
    const whiteStone = renderToStaticMarkup(<PieceIcon code="p" owner="white" variantKey="konane" />);
    const blackStone = renderToStaticMarkup(<PieceIcon code="p" owner="black" variantKey="konane" />);

    expect(whiteStone).toContain('data-piece="stone"');
    expect(whiteStone).toContain('data-piece-label="Stone"');
    expect(whiteStone).toContain('data-skin="stone"');
    expect(blackStone).toContain('data-piece="stone"');
    expect(whiteStone).toContain('aria-label="Stone"');
    expect(blackStone).toContain('data-owner="black"');
  });

  test("shows overlapping captured pieces with material advantage", () => {
    const card = renderToStaticMarkup(
      <BoardPlayerCard
        botLevelLabel="Normal"
        botModeActive={false}
        botStrengthDisplay="1300-1600"
        capturedPieces={[
          { id: "black-queen", code: "q", owner: "black", labelKey: "chess.queen" },
          { id: "black-pawn", code: "p", owner: "black", labelKey: "chess.pawn" }
        ]}
        opponentCapturedPieces={[{ id: "white-knight", code: "n", owner: "white", labelKey: "chess.knight" }]}
        clock={{ color: "white", remainingMs: 600000, incrementMs: 0 }}
        color="white"
        humanColor="white"
        isActive
        placement="bottom"
        thinking={false}
        timeControl="rapid"
        variantKey="classic"
      />
    );

    expect(card).toContain('class="captured-piece"');
    expect(card).toContain('data-capture-index="1"');
    expect(card).toContain('title="Captured Pawn"');
    expect(card).toContain('aria-label="White captured pieces. Material advantage plus 7"');
    expect(card).toContain('data-material-advantage="7"');
    expect(card).toContain('class="captured-material"');
    expect(card).toContain('aria-label="Material advantage plus 7"');
    expect(card).toContain("+7");
  });

  test("summarizes hidden captured pieces when the stack is full", () => {
    const capturedPieces = Array.from({ length: 17 }, (_, index) => ({
      id: `black-pawn-${index}`,
      code: "p",
      owner: "black" as const,
      labelKey: "chess.pawn"
    }));
    const card = renderToStaticMarkup(
      <BoardPlayerCard
        botLevelLabel="Normal"
        botModeActive={false}
        botStrengthDisplay="1300-1600"
        capturedPieces={capturedPieces}
        opponentCapturedPieces={[]}
        clock={{ color: "white", remainingMs: 600000, incrementMs: 0 }}
        color="white"
        humanColor="white"
        isActive
        placement="bottom"
        thinking={false}
        timeControl="rapid"
        variantKey="classic"
      />
    );

    expect(card.match(/class="captured-piece"/g)).toHaveLength(14);
    expect(card).toContain('class="captured-overflow"');
    expect(card).toContain('aria-label="3 more captured pieces"');
    expect(card).toContain("+3");
    expect(card).toContain("+17");
  });

  test("renders pieces in hand as compact draggable buttons", () => {
    const card = renderToStaticMarkup(
      <BoardPlayerCard
        botLevelLabel="Normal"
        botModeActive={false}
        botStrengthDisplay="1300-1600"
        canUseHand
        capturedPieces={[]}
        handCounts={{ p: 2, b: 1 }}
        opponentCapturedPieces={[]}
        clock={{ color: "sente", remainingMs: 600000, incrementMs: 0 }}
        color="sente"
        humanColor="sente"
        isActive
        locale="ja"
        pieceSkin="mini-wedge"
        placement="bottom"
        selectedHandCode="p"
        supportsDrops
        thinking={false}
        timeControl="rapid"
        variantKey="shogi"
      />
    );

    expect(card).toContain('aria-label="Sente hand pieces"');
    expect(card).toContain('aria-label="Drop \u6b69, 2 in hand"');
    expect(card).toContain('class="hand-piece-button focus-ring is-selected"');
    expect(card).toContain('data-hand-state="selected"');
    expect(card).toContain('data-piece-label="\u6b69"');
    expect(card).toContain('data-piece-count="2"');
    expect(card).toContain('data-skin="mini-wedge"');
    expect(card).toContain("draggable=\"true\"");
    expect(card).toContain('aria-hidden="true">2</span>');
  });

  test("shows empty hand and pocket trays for drop variants before captures", () => {
    const shogiCard = renderToStaticMarkup(
      <BoardPlayerCard
        botLevelLabel="Normal"
        botModeActive={false}
        botStrengthDisplay="1300-1600"
        capturedPieces={[]}
        handCounts={{}}
        opponentCapturedPieces={[]}
        clock={{ color: "sente", remainingMs: 600000, incrementMs: 0 }}
        color="sente"
        humanColor="sente"
        isActive
        placement="bottom"
        supportsDrops
        thinking={false}
        timeControl="rapid"
        variantKey="shogi"
      />
    );
    const crazyhouseCard = renderToStaticMarkup(
      <BoardPlayerCard
        botLevelLabel="Normal"
        botModeActive={false}
        botStrengthDisplay="1300-1600"
        capturedPieces={[]}
        handCounts={{}}
        opponentCapturedPieces={[]}
        clock={{ color: "white", remainingMs: 600000, incrementMs: 0 }}
        color="white"
        humanColor="white"
        isActive
        placement="bottom"
        supportsDrops
        thinking={false}
        timeControl="rapid"
        variantKey="crazyhouse"
      />
    );

    expect(shogiCard).toContain('aria-label="Sente hand empty"');
    expect(shogiCard).toContain('class="hand-empty-pill"');
    expect(shogiCard).toContain(">Hand 0</span>");
    expect(crazyhouseCard).toContain('aria-label="White pocket empty"');
    expect(crazyhouseCard).toContain(">Pocket 0</span>");
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
