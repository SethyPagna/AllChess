import type { PlayerColor } from "@/lib/variants";

/** Original silhouettes inspired by turned Cambodian playing sets; no religious iconography. */
export function KhmerPiece({ code, owner, label, promoted }: { code: string; owner: PlayerColor; label: string; promoted: boolean }) {
  const paths: Record<string, string> = {
    k: "M24 86h52l-4-8H28z M31 77h38l-5-14-7-9v-7h7v-6H36v6h7v7l-7 9z M39 40h22l-3-7H42z M43 32h14l-3-9-4-13-4 13z",
    m: "M26 86h48l-5-9H31z M32 76h36l-7-15-5-6v-8H44v8l-5 6z M37 47h26l-5-11-8-8-8 8z",
    s: "M24 86h52l-5-9H29z M32 76h36l-8-16v-5H40v5z M50 18c-4 10-17 17-17 27 0 8 8 13 17 13s17-5 17-13c0-10-13-17-17-27z",
    n: "M24 86h52l-4-9H28z M31 76h38l-6-14 1-20-7-17-10-8-2 10-14 13-4 11 12 4 7-6-2 13z M47 32h2",
    r: "M24 86h52l-5-9H29z M34 76h32l-5-20H39z M23 43l7 15h40l7-15-15 6H38z M24 42v-9l14 10h24l14-10v9",
    p: "M25 74c0-9 11-15 25-15s25 6 25 15v8H25z M25 74c10 8 40 8 50 0 M33 65c8-5 26-5 34 0"
  };
  return <svg viewBox="0 0 100 100" role="img" aria-label={label} className="piece-symbol piece-icon piece-svg khmer-piece" data-owner={owner} data-skin="khmer" data-piece="khmer" data-code={code} data-variant="ouk-chaktrang" data-promoted={promoted || undefined}><title>{label}</title><path d={paths[code] ?? paths.p} />{code === "n" ? <circle cx="47" cy="37" r="2" fill="var(--piece-cutout)" /> : null}<path d={code === "p" ? "M30 80h40" : "M30 81h40"} className="khmer-inlay" fill="none" />{promoted ? <circle cx="50" cy="52" r="4" className="khmer-inlay" /> : null}</svg>;
}
