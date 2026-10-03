import type { PlayerColor } from "@/lib/variants";

/** Original Thai-inspired turned silhouettes, matching the native 3D collection. */
export function MakrukPiece({ code, owner, label, promoted }: { code: string; owner: PlayerColor; label: string; promoted: boolean }) {
  const flipped = promoted && code === "m";
  const paths: Record<string, string> = {
    k: "M24 86h52l-4-8H28z M31 76h38l-6-12 3-7-7-5-2-8H43l-2 8-7 5 3 7z M38 43h24l-4-8H42z M42 34h16l-4-9-4-14-4 14z",
    m: "M26 86h48l-4-9H30z M31 75h38l-8-11-4-14-7-13-7 13-4 14z",
    s: "M25 86h50l-5-9H30z M33 75h34l-6-14H39z M50 23c-3 12-16 16-16 26 0 9 8 14 16 14s16-5 16-14c0-10-13-14-16-26z",
    n: "M25 86h50l-4-9H29z M32 75h36l-6-17-3-11 8 6 10-3-1-10-15-12-9-7-5-12-5 16-6 9-6 17z",
    r: "M27 86h46l-4-8H31z M33 76h34l-7-21H40z M23 43c0 11 9 18 27 18s27-7 27-18c-8 6-46 6-54 0z",
    p: "M24 73c0-9 12-15 26-15s26 6 26 15v9H24z"
  };
  return <svg viewBox="0 0 100 100" role="img" aria-label={label} className="piece-symbol piece-icon piece-svg makruk-piece" data-owner={owner} data-skin="makruk" data-piece={flipped ? "promoted-bia" : ({ k: "khun", m: "met", s: "khon", n: "ma", r: "ruea", p: "bia" } as Record<string, string>)[code]} data-code={code} data-variant="makruk" data-promoted={promoted || undefined}>
    <title>{label}</title><path d={paths[flipped ? "p" : code] ?? paths.p} />
    {code === "r" ? <ellipse cx="50" cy="42" rx="27" ry="8" fill="none" /> : null}
    {code === "n" ? <circle cx="58" cy="36" r="2" fill="var(--piece-cutout)" stroke="none" /> : null}
    {flipped ? <ellipse cx="50" cy="71" rx="16" ry="6" fill="none" data-detail="bia-reverse-face" /> : null}
    <path d={code === "p" || flipped ? "M29 78h42" : "M31 82h38"} fill="none" strokeWidth="2" />
  </svg>;
}
