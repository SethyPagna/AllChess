import { getPieceSkin, resolvePieceSkin, type PieceSkinPreference } from "@/components/board/piece-icon";

export type BoardThemePreference = "classic" | "wood" | "jade" | "ocean" | "contrast" | "slate" | "plum";
export type AppearancePresetPreference = "default" | "classic" | "castle" | "pirate" | "carved" | "glyph" | "badge" | "tablet" | "disc" | "stone" | "contrast" | "slate" | "plum";

export type AppearancePresetOption = {
  key: AppearancePresetPreference;
  label: string;
  boardTheme: BoardThemePreference;
  pieceSkin: PieceSkinPreference;
};

export type BoardThemeOption = {
  key: BoardThemePreference;
  label: string;
};

const boardThemeLabels: Record<BoardThemePreference, string> = {
  classic: "Classic green",
  wood: "Warm wood",
  jade: "Jade clear",
  ocean: "Ocean clear",
  contrast: "High contrast",
  slate: "Slate blue",
  plum: "Soft plum"
};

export const boardThemeOptions: BoardThemeOption[] = (Object.keys(boardThemeLabels) as BoardThemePreference[]).map((key) => ({
  key,
  label: boardThemeLabels[key]
}));

const familyPresets: Record<string, AppearancePresetOption[]> = {
  western: [
    preset("default", "Auto matched", "classic", "default"),
    preset("classic", "Classic set", "classic", "western"),
    preset("castle", "Castle set", "jade", "castle"),
    preset("pirate", "Pirate set", "ocean", "pirate"),
    preset("glyph", "Glyph set", "contrast", "glyph"),
    preset("badge", "Badge set", "jade", "monogram"),
    preset("carved", "Carved set", "wood", "silhouette")
  ],
  shogi: [
    preset("default", "Auto matched", "wood", "default"),
    preset("carved", "Wood wedge", "wood", "wedge"),
    preset("tablet", "Tablets", "jade", "tile"),
    preset("contrast", "Clear wedge", "contrast", "wedge")
  ],
  "mini-shogi": [
    preset("default", "Auto matched", "wood", "default"),
    preset("carved", "Mini wedge", "wood", "mini-wedge"),
    preset("tablet", "Tablets", "jade", "tile"),
    preset("contrast", "Clear compact", "contrast", "mini-wedge")
  ],
  disc: [
    preset("default", "Auto matched", "classic", "default"),
    preset("disc", "Disc set", "classic", "disc"),
    preset("tablet", "Tile set", "jade", "tile"),
    preset("contrast", "Clear discs", "contrast", "disc")
  ],
  jungle: [
    preset("default", "Auto matched", "jade", "default"),
    preset("tablet", "Animal tiles", "jade", "tile"),
    preset("disc", "Round ranks", "ocean", "disc"),
    preset("contrast", "Clear tiles", "contrast", "tile")
  ],
  checker: [
    preset("default", "Auto matched", "classic", "default"),
    preset("classic", "Checker set", "classic", "checker"),
    preset("stone", "Stone set", "contrast", "stone")
  ],
  stone: [
    preset("default", "Auto matched", "contrast", "default"),
    preset("stone", "Stone set", "contrast", "stone"),
    preset("classic", "Checker set", "classic", "checker")
  ],
  makruk: [
    preset("default", "Auto matched", "wood", "default"),
    preset("carved", "Carved set", "wood", "silhouette"),
    preset("castle", "Castle set", "jade", "castle"),
    preset("glyph", "Glyph set", "contrast", "glyph"),
    preset("badge", "Badge set", "jade", "monogram")
  ]
};

export function getAppearancePresetOptions(variantKey: string) {
  const options = familyPresets[appearanceFamily(variantKey)];
  const defaults = defaultBoards[variantKey];
  return [
    ...options.map((option) => option.key === "default" && defaults ? { ...option, label: defaults.label, boardTheme: defaults.boardTheme } : option),
    preset("slate", "Midnight slate", "slate", getPieceSkin(variantKey)),
    preset("plum", "Quiet plum", "plum", getPieceSkin(variantKey))
  ];
}

const defaultBoards: Record<string, { label: string; boardTheme: BoardThemePreference }> = {
  classic: { label: "Club green", boardTheme: "classic" },
  chess960: { label: "Fischer slate", boardTheme: "slate" },
  crazyhouse: { label: "Pocket plum", boardTheme: "plum" },
  chaturanga: { label: "Ancient wood", boardTheme: "wood" },
  shatranj: { label: "Persian wood", boardTheme: "wood" },
  shogi: { label: "Kaya wood", boardTheme: "wood" },
  "mini-shogi": { label: "Mini kaya", boardTheme: "wood" },
  xiangqi: { label: "River wood", boardTheme: "wood" },
  janggi: { label: "Palace blue", boardTheme: "ocean" },
  makruk: { label: "Thai wood", boardTheme: "wood" },
  jungle: { label: "Forest jade", boardTheme: "jade" },
  "international-draughts": { label: "Tournament slate", boardTheme: "slate" },
  "turkish-draughts": { label: "Warm wood", boardTheme: "wood" },
  antichess: { label: "Reverse plum", boardTheme: "plum" },
  horde: { label: "Horde wood", boardTheme: "wood" },
  "king-of-the-hill": { label: "Summit jade", boardTheme: "jade" },
  "three-check": { label: "Triple plum", boardTheme: "plum" },
  "racing-kings": { label: "Racing slate", boardTheme: "slate" }
};

export function resolveAppearancePreset(variantKey: string, preference: AppearancePresetPreference = "default") {
  const options = getAppearancePresetOptions(variantKey);
  const selected = options.find((option) => option.key === preference) ?? options[0];
  return {
    ...selected,
    pieceSkin: resolvePieceSkin(variantKey, selected.pieceSkin === "default" ? getPieceSkin(variantKey) : selected.pieceSkin)
  };
}

export function isAppearancePresetPreference(variantKey: string, value: string | null): value is AppearancePresetPreference {
  if (!value) return false;
  return getAppearancePresetOptions(variantKey).some((option) => option.key === value);
}

function appearanceFamily(variantKey: string) {
  if (variantKey === "shogi") return "shogi";
  if (variantKey === "mini-shogi") return "mini-shogi";
  if (variantKey === "xiangqi" || variantKey === "janggi") return "disc";
  if (variantKey === "jungle") return "jungle";
  if (variantKey === "english-draughts" || variantKey === "international-draughts" || variantKey === "turkish-draughts") return "checker";
  if (variantKey === "konane") return "stone";
  if (variantKey === "makruk") return "makruk";
  return "western";
}

function preset(key: AppearancePresetPreference, label: string, boardTheme: BoardThemePreference, pieceSkin: PieceSkinPreference): AppearancePresetOption {
  return { key, label, boardTheme, pieceSkin };
}
