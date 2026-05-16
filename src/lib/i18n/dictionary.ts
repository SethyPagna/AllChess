import { defaultLocale, type LocaleCode } from "./locales";

export type TranslationNamespace =
  | "app"
  | "nav"
  | "auth"
  | "lobby"
  | "play"
  | "variants"
  | "history"
  | "analysis"
  | "settings"
  | "errors"
  | "chess";

type FlatDictionary = Record<string, string>;

const en = {
  "app.name": "AllChess",
  "app.tagline": "Every board, every rival, one polished arena.",
  "app.description": "A multilingual multiplayer chess platform with global variants, realtime rooms, records, and AI review.",
  "nav.home": "Home",
  "nav.lobby": "Lobby",
  "nav.play": "Play",
  "nav.learn": "Learn",
  "nav.learnPractice": "Learn & Practice",
  "nav.practice": "Practice",
  "nav.gamesRules": "Games & rules",
  "nav.learnRules": "Rule guides",
  "nav.watch": "Watch",
  "nav.community": "Community",
  "nav.account": "Account",
  "nav.watchRooms": "Watch rooms",
  "nav.library": "Library",
  "nav.variants": "Variants",
  "nav.history": "History",
  "nav.leaderboards": "Leaderboards",
  "nav.settings": "Settings",
  "nav.login": "Sign in",
  "nav.profile": "Profile",
  "auth.title": "Welcome back",
  "auth.subtitle": "Sign in with AllChess auth to keep ratings, records, and preferences synced in Cloudflare D1.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.magic": "Send magic link",
  "auth.demo": "Continue as guest",
  "lobby.title": "Game lobby",
  "lobby.quickPair": "Quick pair",
  "lobby.privateRoom": "Private room",
  "lobby.correspondence": "Correspondence",
  "lobby.aiPractice": "AI practice",
  "lobby.online": "players online",
  "lobby.create": "Create game",
  "lobby.join": "Join room",
  "play.yourMove": "Your move",
  "play.waiting": "Waiting for opponent",
  "play.chat": "Table chat",
  "play.moves": "Moves",
  "play.resign": "Resign",
  "play.draw": "Offer draw",
  "play.rematch": "Rematch",
  "play.undo": "Undo",
  "play.flip": "Flip board",
  "play.analysis": "AI review",
  "variants.title": "Games & rules",
  "variants.subtitle": "Choose a game family, learn the basics, then practice verified boards.",
  "history.title": "Match records",
  "history.subtitle": "Replay finished games, audit moves, and review ratings.",
  "analysis.title": "AI analysis",
  "analysis.subtitle": "Explain plans, blunders, tactics, and next training ideas.",
  "settings.title": "Preferences",
  "settings.theme": "Theme",
  "settings.language": "Language",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.system": "System",
  "settings.board": "Board style",
  "settings.sound": "Sound",
  "errors.required": "This field is required.",
  "errors.invalidMove": "That move is not legal in this variant.",
  "errors.notConfigured": "The service is not configured yet.",
  "chess.check": "Check",
  "chess.checkmate": "Checkmate",
  "chess.stalemate": "Stalemate",
  "chess.resignation": "Resignation",
  "chess.draw": "Draw",
  "chess.win": "Win",
  "chess.loss": "Loss",
  "chess.clock": "Clock",
  "chess.rating": "Rating",
  "chess.puzzle": "Puzzle",
  "chess.replay": "Replay",
  "chess.opening": "Opening",
  "chess.endgame": "Endgame",
  "chess.king": "King",
  "chess.queen": "Queen",
  "chess.rook": "Rook",
  "chess.bishop": "Bishop",
  "chess.knight": "Knight",
  "chess.pawn": "Pawn",
  "variant.classic": "Classic Chess",
  "variant.chess960": "Chess960",
  "variant.xiangqi": "Xiangqi",
  "variant.shogi": "Shogi",
  "variant.janggi": "Janggi",
  "variant.makruk": "Makruk",
  "variant.jungle": "Jungle Chess",
  "variant.antichess": "Antichess",
  "variant.horde": "Horde",
  "variant.king-of-the-hill": "King of the Hill",
  "variant.three-check": "Three-check"
} satisfies FlatDictionary;

const packs: Record<LocaleCode, Partial<FlatDictionary>> = {
  en,
  km: {
    "app.name": "អាល់ឆេស",
    "app.tagline": "ក្តារគ្រប់ប្រភេទ គូប្រកួតគ្រប់ទីកន្លែង ក្នុងសង្វៀនតែមួយ។",
    "nav.home": "ទំព័រដើម",
    "nav.lobby": "បន្ទប់លេង",
    "nav.variants": "ប្រភេទល្បែង",
    "nav.history": "ប្រវត្តិ",
    "nav.settings": "ការកំណត់",
    "nav.login": "ចូល",
    "lobby.title": "បន្ទប់លេង",
    "play.yourMove": "ដល់វេនអ្នក",
    "settings.language": "ភាសា",
    "settings.theme": "រូបរាង",
    "settings.light": "ភ្លឺ",
    "settings.dark": "ងងឹត",
    "variant.classic": "អុកសកល",
    "variant.xiangqi": "អុកចិន",
    "variant.jungle": "អុកព្រៃ"
  },
  "zh-CN": {
    "app.name": "AllChess",
    "app.tagline": "所有棋盘，所有对手，一个成熟竞技场。",
    "nav.home": "首页",
    "nav.lobby": "大厅",
    "nav.variants": "棋类",
    "nav.history": "记录",
    "nav.settings": "设置",
    "nav.login": "登录",
    "lobby.title": "对局大厅",
    "play.yourMove": "轮到你",
    "settings.language": "语言",
    "settings.theme": "主题",
    "variant.classic": "国际象棋",
    "variant.xiangqi": "中国象棋",
    "variant.shogi": "将棋"
  },
  "zh-TW": {
    "app.tagline": "所有棋盤、所有對手，都在同一個成熟競技場。",
    "nav.home": "首頁",
    "nav.lobby": "大廳",
    "nav.variants": "棋類",
    "nav.history": "紀錄",
    "nav.settings": "設定",
    "nav.login": "登入",
    "lobby.title": "對局大廳",
    "play.yourMove": "輪到你",
    "settings.language": "語言",
    "settings.theme": "主題",
    "variant.classic": "國際象棋",
    "variant.xiangqi": "中國象棋",
    "variant.shogi": "將棋"
  },
  vi: {
    "app.tagline": "Mọi bàn cờ, mọi đối thủ, trong một đấu trường tinh tế.",
    "nav.home": "Trang chủ",
    "nav.lobby": "Sảnh",
    "nav.variants": "Biến thể",
    "nav.history": "Lịch sử",
    "nav.settings": "Cài đặt",
    "nav.login": "Đăng nhập",
    "lobby.title": "Sảnh đấu",
    "play.yourMove": "Lượt của bạn",
    "settings.language": "Ngôn ngữ",
    "settings.theme": "Giao diện"
  },
  th: {
    "app.tagline": "ทุกกระดาน ทุกคู่แข่ง ในสนามเดียวที่พร้อมใช้งานจริง",
    "nav.home": "หน้าแรก",
    "nav.lobby": "ล็อบบี้",
    "nav.variants": "รูปแบบเกม",
    "nav.history": "ประวัติ",
    "nav.settings": "ตั้งค่า",
    "nav.login": "เข้าสู่ระบบ",
    "lobby.title": "ล็อบบี้เกม",
    "play.yourMove": "ตาคุณ",
    "settings.language": "ภาษา",
    "settings.theme": "ธีม"
  },
  ru: {
    "app.tagline": "Все доски и соперники в одной зрелой арене.",
    "nav.home": "Главная",
    "nav.lobby": "Лобби",
    "nav.variants": "Варианты",
    "nav.history": "История",
    "nav.settings": "Настройки",
    "nav.login": "Войти",
    "lobby.title": "Игровое лобби",
    "play.yourMove": "Ваш ход",
    "settings.language": "Язык",
    "settings.theme": "Тема"
  },
  fr: {
    "app.tagline": "Tous les plateaux, tous les adversaires, une seule arène raffinée.",
    "nav.home": "Accueil",
    "nav.lobby": "Salon",
    "nav.variants": "Variantes",
    "nav.history": "Historique",
    "nav.settings": "Réglages",
    "nav.login": "Connexion",
    "lobby.title": "Salon de jeu",
    "play.yourMove": "À vous de jouer",
    "settings.language": "Langue",
    "settings.theme": "Thème"
  },
  es: {
    "app.tagline": "Todos los tableros y rivales en una arena madura.",
    "nav.home": "Inicio",
    "nav.lobby": "Sala",
    "nav.variants": "Variantes",
    "nav.history": "Historial",
    "nav.settings": "Ajustes",
    "nav.login": "Entrar",
    "lobby.title": "Sala de juego",
    "play.yourMove": "Tu turno",
    "settings.language": "Idioma",
    "settings.theme": "Tema"
  },
  de: {
    "app.tagline": "Jedes Brett, jeder Gegner, eine ausgereifte Arena.",
    "nav.home": "Start",
    "nav.lobby": "Lobby",
    "nav.variants": "Varianten",
    "nav.history": "Verlauf",
    "nav.settings": "Einstellungen",
    "nav.login": "Anmelden",
    "lobby.title": "Spiellobby",
    "play.yourMove": "Du bist am Zug",
    "settings.language": "Sprache",
    "settings.theme": "Design"
  },
  ja: {
    "app.tagline": "あらゆる盤と相手を、ひとつの洗練されたアリーナで。",
    "nav.home": "ホーム",
    "nav.lobby": "ロビー",
    "nav.variants": "バリアント",
    "nav.history": "履歴",
    "nav.settings": "設定",
    "nav.login": "ログイン",
    "lobby.title": "ゲームロビー",
    "play.yourMove": "あなたの手番",
    "settings.language": "言語",
    "settings.theme": "テーマ"
  },
  ko: {
    "app.tagline": "모든 보드와 상대를 하나의 완성도 높은 경기장에서.",
    "nav.home": "홈",
    "nav.lobby": "로비",
    "nav.variants": "변형",
    "nav.history": "기록",
    "nav.settings": "설정",
    "nav.login": "로그인",
    "lobby.title": "게임 로비",
    "play.yourMove": "내 차례",
    "settings.language": "언어",
    "settings.theme": "테마"
  },
  pt: {
    "app.tagline": "Todos os tabuleiros e rivais em uma arena madura.",
    "nav.home": "Início",
    "nav.lobby": "Lobby",
    "nav.variants": "Variantes",
    "nav.history": "Histórico",
    "nav.settings": "Configurações",
    "nav.login": "Entrar",
    "lobby.title": "Lobby de jogo",
    "play.yourMove": "Sua vez",
    "settings.language": "Idioma",
    "settings.theme": "Tema"
  },
  it: {
    "app.tagline": "Ogni scacchiera e ogni rivale in un'arena matura.",
    "nav.home": "Home",
    "nav.lobby": "Lobby",
    "nav.variants": "Varianti",
    "nav.history": "Cronologia",
    "nav.settings": "Impostazioni",
    "nav.login": "Accedi",
    "lobby.title": "Lobby di gioco",
    "play.yourMove": "Tocca a te",
    "settings.language": "Lingua",
    "settings.theme": "Tema"
  },
  ar: {
    "app.tagline": "كل الرقع وكل المنافسين في ساحة واحدة ناضجة.",
    "nav.home": "الرئيسية",
    "nav.lobby": "الردهة",
    "nav.variants": "الأنواع",
    "nav.history": "السجل",
    "nav.settings": "الإعدادات",
    "nav.login": "تسجيل الدخول",
    "lobby.title": "ردهة اللعب",
    "play.yourMove": "دورك",
    "settings.language": "اللغة",
    "settings.theme": "المظهر"
  },
  hi: {
    "app.tagline": "हर बोर्ड और हर प्रतिद्वंद्वी, एक परिपक्व अखाड़े में।",
    "nav.home": "होम",
    "nav.lobby": "लॉबी",
    "nav.variants": "रूपांतर",
    "nav.history": "इतिहास",
    "nav.settings": "सेटिंग्स",
    "nav.login": "साइन इन",
    "lobby.title": "गेम लॉबी",
    "play.yourMove": "आपकी चाल",
    "settings.language": "भाषा",
    "settings.theme": "थीम"
  },
  id: {
    "app.tagline": "Semua papan dan lawan dalam satu arena matang.",
    "nav.home": "Beranda",
    "nav.lobby": "Lobi",
    "nav.variants": "Varian",
    "nav.history": "Riwayat",
    "nav.settings": "Pengaturan",
    "nav.login": "Masuk",
    "lobby.title": "Lobi permainan",
    "play.yourMove": "Giliran Anda",
    "settings.language": "Bahasa",
    "settings.theme": "Tema"
  },
  ms: {
    "app.tagline": "Semua papan dan lawan dalam satu arena matang.",
    "nav.home": "Laman utama",
    "nav.lobby": "Lobi",
    "nav.variants": "Varian",
    "nav.history": "Sejarah",
    "nav.settings": "Tetapan",
    "nav.login": "Log masuk",
    "lobby.title": "Lobi permainan",
    "play.yourMove": "Giliran anda",
    "settings.language": "Bahasa",
    "settings.theme": "Tema"
  },
  tr: {
    "app.tagline": "Her tahta ve her rakip tek olgun arenada.",
    "nav.home": "Ana sayfa",
    "nav.lobby": "Lobi",
    "nav.variants": "Varyantlar",
    "nav.history": "Geçmiş",
    "nav.settings": "Ayarlar",
    "nav.login": "Giriş",
    "lobby.title": "Oyun lobisi",
    "play.yourMove": "Sıra sende",
    "settings.language": "Dil",
    "settings.theme": "Tema"
  }
};

export function getDictionary(locale: LocaleCode): FlatDictionary {
  return { ...en, ...packs[locale] };
}

export function createTranslator(locale: LocaleCode) {
  const dictionary = getDictionary(locale);
  return function t(key: keyof typeof en | string) {
    return dictionary[key] ?? packs[defaultLocale]?.[key] ?? key;
  };
}

export function dictionaryKeys() {
  return Object.keys(en).sort();
}

export function missingKeys(locale: LocaleCode) {
  const dictionary = getDictionary(locale);
  return dictionaryKeys().filter((key) => !dictionary[key]);
}
