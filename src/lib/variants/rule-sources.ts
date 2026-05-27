export const ruleSources = {
  classic: [
    {
      name: "FIDE Laws of Chess",
      url: "https://rcc.fide.com/fide-laws-of-chess_fulltexthtml/",
      scope: ["legal moves", "check", "castling", "promotion", "stalemate", "clock"]
    }
  ],
  chess960: [
    {
      name: "FIDE Laws of Chess, Chess960 Guidelines",
      url: "https://rcc.fide.com/fide-laws-of-chess_fulltexthtml/",
      scope: ["Chess960 castling", "legal moves", "check"]
    }
  ],
  xiangqi: [
    {
      name: "World Xiangqi Federation World Xiangqi Rules 2018",
      url: "https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf",
      scope: ["general", "advisor", "elephant", "horse", "cannon", "flying general", "stalemate loss"]
    }
  ],
  shogi: [
    {
      name: "Japan Shogi Association basic rules",
      url: "https://www.shogi.or.jp/knowledge/shogi/02.html",
      scope: ["piece movement", "captures", "drops", "promotion"]
    },
    {
      name: "Japan Shogi Association tournament rules and illegal moves",
      url: "https://www.shogi.or.jp/event/Rules%20and%20regulations.pdf",
      scope: ["nifu", "self-check", "non-movable drops", "pawn-drop mate", "perpetual check"]
    }
  ],
  makruk: [
    {
      name: "GNU XBoard Makruk rules",
      url: "https://www.gnu.org/software/xboard/whats_new/rules/Makruk.html",
      scope: ["Thai chess piece movement", "promotion"]
    }
  ],
  jungle: [
    {
      name: "Yellow Mountain Imports Dou Shou Qi rules",
      url: "https://ymimports.onsitesupport.io/yellowmountainimports/knowledge-base/article/how-to-play-jungle-dou-shou-qi-%E9%AC%A5%E7%8D%B8%E6%A3%8B",
      scope: ["animal ranking", "river", "trap", "den"]
    }
  ]
} as const;
