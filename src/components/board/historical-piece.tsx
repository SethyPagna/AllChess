import { collectionPieces } from "./board-3d-config";
import type { PlayerColor } from "@/lib/variants";

const indianPaths: Record<string, string> = {
  k: "M22 87h56l-4-9H26z M34 75h32V45H34z M22 44h56L61 28H39z M42 27h16l-8-14z",
  m: "M27 87h46l-4-9H31z M37 75h26l-6-23H43z M28 51h44L58 35H42z M46 34h8V22h-8z",
  e: "M21 87h58l-5-7H26z M27 76V58c-12-27 2-37 22-32 11-14 30-3 27 11l7 10-2 23-9 4-6-6 8-3V49l-8 7-5-7v27H49V61H38v15z",
  n: "M23 87h54l-5-8H28z M31 76l1-29 10-20 6-16 7 17 21 13v12l-11 3-9-7 2 27z",
  r: "M22 87h56l-4-8H26z M29 69h42V48H29z M32 47V30h5v17 M63 47V30h5v17 M23 30h54L65 19H35z",
  p: "M29 87h42l-4-8H33z M36 76l7-24h14l7 24z M36 43a14 14 0 0 1 28 0v8H36z M47 26h6v10h-6z"
};
const persianPaths: Record<string, string> = {
  k: "M23 86h54l-3-9H26z M27 76V22q0-8 8-8h30q8 0 8 8v54z M36 49h28v25H36z",
  f: "M27 86h46l-3-9H30z M31 76V39q0-8 8-8h22q8 0 8 8v37z M39 59h22v15H39z",
  a: "M26 86h48l-3-9H29z M30 76l3-35q3-10 17-10t17 10l3 35z M37 36l-3-19q4-5 8 0l3 16 M55 33l3-16q4-5 8 0l-3 19",
  n: "M26 86h48l-3-9H29z M31 76l2-34q0-14 15-20l25 20-5 11-16-6 10 29z",
  r: "M25 86h50l-3-9H28z M29 76V26l14 3 7 16 7-16 14-3v50z",
  p: "M29 86h42l-3-9H32z M29 76l4-18 17-10 17 10 4 18z M44 48V37q6-8 12 0v11z"
};

/** Original 2D companions to the sculpted and abstract 3D collections. */
export function HistoricalPiece({code,owner,label,variantKey,promoted,skin}: {code:string;owner:PlayerColor;label:string;variantKey:string;promoted:boolean;skin:"western"|"silhouette"}) {
  const indian=variantKey==="chaturanga";
  return <svg viewBox="0 0 100 100" role="img" aria-label={label} className="piece-symbol piece-icon piece-svg" data-owner={owner} data-skin={skin} data-piece-label={label} data-code={code} data-piece={collectionPieces[indian ? "chaturanga" : "shatranj"][code]} data-variant={variantKey} data-promoted={promoted || undefined}>
    <title>{label}</title><path d={(indian?indianPaths:persianPaths)[code]} strokeLinejoin="round" />
    {indian && code==="r" ? <><circle cx="34" cy="71" r="8"/><circle cx="66" cy="71" r="8"/></> : null}
    {indian && code==="e" ? <path d="M50 36q-15-3-9 16q14 4 9-16 M66 41h1" fill="none"/> : null}
    <path d="M32 82h36" fill="none" strokeWidth="2"/>
  </svg>;
}

export function historicalPieceHint(variantKey:string,code?:string) {
  if (!code || (variantKey!=="shatranj" && variantKey!=="chaturanga")) return "";
  const names:Record<string,string>=variantKey==="chaturanga" ? {k:"Raja",m:"Minister",e:"Elephant",n:"Horse",r:"Chariot",p:"Infantry"} : {k:"Shah",f:"Ferz",a:"Alfil",n:"Horse",r:"Rukh",p:"Pawn"};
  const moves:Record<string,string>={k:"one square in any direction",m:"one square diagonally",f:"one square diagonally",e:"jumps exactly two squares diagonally",a:"jumps exactly two squares diagonally",n:"jumps in an L shape",r:"any distance along a rank or file",p:`one step forward · captures diagonally · promotes to ${variantKey==="chaturanga"?"minister":"ferz"}`};
  return code in names ? `${names[code]} · ${moves[code]}` : "";
}
