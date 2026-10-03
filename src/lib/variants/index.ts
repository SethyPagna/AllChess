export { variantCatalog, getVariant, type VariantKey } from "./catalog";
export { formatVariantPlayMeta } from "./display";
export { applyMove, createInitialState, findLegalMove, getCastlingRights, getLegalMoves, isRoyal, serializeSquare, sameSquare, westernPromotionChoices, type CastlingRight } from "./engine";
export { canWinOnTime } from "./mating-material";
export { CHESS960_PROFILE, LEGACY_CHESS960_BACK_RANK, chess960BackRank, chess960IndexForId, isChess960BackRank, readChess960BackRank, restoreChess960Opening, usesChess960RandomSetup } from "./chess960";
export type { BoardCell, GameState, Move, Piece, PlayerClock, PlayerColor, Square, VariantDefinition } from "./types";
