import { describe, expect, test } from "vitest";

import { cancelBotMove, chooseBotMove, chooseBotMoveSafe, botDifficultyLevels, MAX_BOT_REPLY_MS, requestBotMove } from "@/lib/bot/runtime";
import {
  createBotBoardSignature,
  createBotPositionKey,
  getBotKnowledgeIndexStats,
  getBotRuntimeLanguageProfile,
  getBotTrainingGateSummary,
  listBotEngineLabels,
  listBotKnowledge,
  listBotKnowledgeSummary,
  listBotModelManifests,
  listBotTrainingChecklists,
  listBotToolManifests,
  listTrainingDataManifests,
  lookupBotKnowledge
} from "@/lib/bot/training";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

describe("bot difficulty ladder", () => {
  test("defines the requested six difficulty levels in increasing search budget", () => {
    expect(botDifficultyLevels.map((level) => level.key)).toEqual(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]);
    expect(botDifficultyLevels.map((level) => level.label)).toEqual(["Easy", "Normal", "Hard", "Very Hard", "Grandmaster", "Legend"]);
    expect(botDifficultyLevels.map((level) => level.strength.targetElo)).toEqual([1050, 1450, 1900, 2300, 2850, 3190]);
    expect(botDifficultyLevels.map((level) => level.strength.stockfishUciElo)).toEqual([1320, 1450, 1900, 2300, 2850, 3190]);
    expect(botDifficultyLevels.every((level) => level.strength.minElo <= level.strength.targetElo)).toBe(true);

    const budgets = botDifficultyLevels.map((level) => level.depth * level.moveTimeMs);
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets);
    expect(botDifficultyLevels.map((level) => level.beamWidth)).toEqual([10, 16, 22, 32, 34, 46]);
    expect(botDifficultyLevels.map((level) => level.quiescenceDepth)).toEqual([1, 1, 2, 2, 2, 4]);
    expect(botDifficultyLevels.map((level) => level.riskTolerance)).toEqual([0.42, 0.32, 0.22, 0.13, 0.1, 0.03]);
    expect(botDifficultyLevels.map((level) => level.replyCheckWidth)).toEqual([5, 8, 12, 17, 17, 24]);
    expect(Math.max(...botDifficultyLevels.map((level) => level.moveTimeMs))).toBeLessThanOrEqual(MAX_BOT_REPLY_MS);
  });

  test("lower tiers are smarter without exceeding the reply budget", () => {
    const [easy, normal, hard, veryHard] = botDifficultyLevels;

    expect(easy.depth).toBeGreaterThanOrEqual(3);
    expect(easy.skill).toBeGreaterThanOrEqual(8);
    expect(easy.replyCheckWidth).toBeGreaterThanOrEqual(5);
    expect(normal.quiescenceDepth).toBeGreaterThanOrEqual(1);
    expect(normal.nodeBudget).toBeGreaterThan(1500);
    expect(hard.replyCheckWidth).toBeGreaterThanOrEqual(12);
    expect(hard.quiescenceDepth).toBeGreaterThanOrEqual(2);
    expect(veryHard.nodeBudget).toBeGreaterThan(8000);
    expect([easy, normal, hard, veryHard].every((level) => level.moveTimeMs < MAX_BOT_REPLY_MS)).toBe(true);
  });

  test("always chooses a legal move for every launch variant", () => {
    const variants = ["classic", "chess960", "xiangqi", "shogi", "janggi", "makruk", "jungle", "antichess", "horde", "king-of-the-hill", "three-check"];

    for (const variantKey of variants) {
      const state = createInitialState(variantKey, `${variantKey}-bot`);
      const botMove = chooseBotMove(state, "normal", { maxSearchTimeMs: 40 });
      const legalMoves = state.board.flatMap((row) => row.flatMap((cell) => getLegalMoves(state, cell.square)));

      expect(legalMoves).toContainEqual(expect.objectContaining({ from: botMove.from, to: botMove.to }));
      expect(() => applyMove(state, botMove)).not.toThrow();
    }
  }, 15_000);

  test("legend difficulty prefers immediate checkmate over material", () => {
    let state = createInitialState("classic", "mate-test");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[7][7].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };

    const move = chooseBotMove(state, "legend");

    expect(move).toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
    expect(applyMove(state, move)).toMatchObject({ status: "completed", result: "white" });
  });

  test("easy difficulty is weaker without being naive about immediate wins", () => {
    let state = createInitialState("classic", "difficulty-test");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const easy = chooseBotMove(state, "easy");
    const legend = chooseBotMove(state, "legend");

    expect(easy).toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
    expect(legend.to).toEqual({ row: 1, col: 1 });
  });

  test("lower tiers avoid simple bad trades with major pieces", () => {
    let state = createInitialState("classic", "bad-trade-filter");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[1][5].piece = { id: "black-knight", code: "n", owner: "black", labelKey: "chess.knight" };
    state.board[3][4].piece = { id: "black-pawn", code: "p", owner: "black", labelKey: "chess.pawn" };
    state.board[4][3].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const defendedPawnCapture = { from: { row: 4, col: 3 }, to: { row: 3, col: 4 } };
    const hardSearch = chooseBotMoveSafe(state, "hard", { engine: "internal", maxSearchTimeMs: 40 });

    expect(chooseBotMove(state, "easy", { engine: "internal", maxSearchTimeMs: 80 })).not.toMatchObject(defendedPawnCapture);
    expect(chooseBotMove(state, "normal", { engine: "internal", maxSearchTimeMs: 80 })).not.toMatchObject(defendedPawnCapture);
    if (hardSearch.reason !== "ok") throw new Error("Expected hard search to return a legal move.");
    expect(hardSearch.move).not.toMatchObject(defendedPawnCapture);
    expect(hardSearch.elapsedMs).toBeLessThan(MAX_BOT_REPLY_MS);
  });

  test("normal difficulty blocks an immediate variant objective threat", () => {
    let state = createInitialState("king-of-the-hill", "block-hill-threat");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[4][2].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[7][4].piece = { id: "white-rook", code: "r", owner: "white", labelKey: "chess.rook" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const opponentTurnState = { ...state, turn: "black" as const };
    const initialTerminalReplies = opponentTurnState.board
      .flatMap((row) => row.flatMap((cell) => getLegalMoves(opponentTurnState, cell.square)))
      .filter((reply) => {
        const afterReply = applyMove(opponentTurnState, reply);
        return afterReply.status === "completed" && afterReply.result === "black";
      });
    const move = chooseBotMove(state, "normal", { engine: "internal", maxSearchTimeMs: 80 });
    const afterMove = applyMove(state, move);
    const terminalReplies = afterMove.board
      .flatMap((row) => row.flatMap((cell) => getLegalMoves(afterMove, cell.square)))
      .filter((reply) => {
        const afterReply = applyMove(afterMove, reply);
        return afterReply.status === "completed" && afterReply.result === "black";
      });

    expect(terminalReplies.length).toBeLessThan(initialTerminalReplies.length);
  });

  test("bot explanation reports immediate threat defense", async () => {
    let state = createInitialState("king-of-the-hill", "hill-threat-explanation");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[4][2].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[7][4].piece = { id: "white-rook", code: "r", owner: "white", labelKey: "chess.rook" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const result = await requestBotMove(state, "normal", { engine: "internal", maxSearchTimeMs: 80 });

    expect(result.explanation?.risk).toContain("Threat defense");
  });

  test("legend difficulty values promotion as a decisive strategic gain", () => {
    let state = createInitialState("classic", "bot-promotion");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[1][0].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[0][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };

    expect(chooseBotMove(state, "legend")).toMatchObject({ from: { row: 1, col: 0 }, to: { row: 0, col: 0 } });
  });

  test("safe bot move returns a completed state instead of throwing when no legal moves exist", () => {
    const state = createInitialState("classic", "no-moves");
    const blocked = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      status: "active" as const,
      turn: "white" as const
    };

    expect(chooseBotMoveSafe(blocked, "normal")).toEqual({ move: null, reason: "no-legal-moves" });
  });

  test("async bot request reports a validated legal move with search metadata", async () => {
    const initial = createInitialState("classic", "async-bot");
    const offBookMove = getLegalMoves(initial, { row: 6, col: 7 }).find((move) => move.to.row === 5 && move.to.col === 7);
    if (!offBookMove) throw new Error("Expected h3 to be legal.");
    const state = applyMove(initial, offBookMove);

    const result = await requestBotMove(state, "hard", { engine: "internal", maxSearchTimeMs: 60 });

    expect(result.status).toBe("ok");
    expect(result.move).toBeTruthy();
    expect(result.engine).toBe("internal");
    expect(result.validatedLegal).toBe(true);
    expect(result.legalValidated).toBe(true);
    expect(result.depthReached).toBeGreaterThanOrEqual(1);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.nodesSearched).toBeGreaterThan(0);
    expect(result.evaluation).toEqual(expect.any(Number));
    expect(result.searchEfficiency).toEqual(
      expect.objectContaining({
        nodes: result.nodesSearched,
        cachedPositions: expect.any(Number),
        moveGenerationCalls: expect.any(Number),
        cacheHits: expect.any(Number),
        transpositionEntries: expect.any(Number),
        transpositionHits: expect.any(Number)
      })
    );
  });

  test("internal search reports reusable legal-move cache efficiency", () => {
    const state = createInitialState("classic", "search-efficiency");
    const result = chooseBotMoveSafe(state, "legend", { maxSearchTimeMs: 90, engine: "internal" });

    expect(result.reason).toBe("ok");
    if (!result.move) throw new Error("Expected a legal bot move.");
    expect(result.searchEfficiency).toEqual(
      expect.objectContaining({
        nodes: result.nodesSearched,
        cachedPositions: expect.any(Number),
        moveGenerationCalls: expect.any(Number),
        cacheHits: expect.any(Number),
        transpositionEntries: expect.any(Number),
        transpositionHits: expect.any(Number)
      })
    );
    expect(result.searchEfficiency.cachedPositions).toBe(result.searchEfficiency.moveGenerationCalls);
    expect(result.searchEfficiency.cacheHits).toBeGreaterThan(0);
    expect(result.searchEfficiency.transpositionEntries).toBeGreaterThan(0);
  });

  test("internal search reuses bounded transpositions across repeated requests", () => {
    const state = createInitialState("classic", "repeated-search-efficiency");
    const first = chooseBotMoveSafe(state, "very-hard", { maxSearchTimeMs: 90, engine: "internal" });
    const second = chooseBotMoveSafe(state, "very-hard", { maxSearchTimeMs: 90, engine: "internal" });

    expect(first.reason).toBe("ok");
    expect(second.reason).toBe("ok");
    if (!first.move) throw new Error("Expected an initial legal search move.");
    if (!second.move) throw new Error("Expected a legal cached-search move.");
    expect(() => applyMove(state, second.move)).not.toThrow();
    expect(second.searchEfficiency.transpositionHits).toBeGreaterThan(first.searchEfficiency.transpositionHits);
    expect(second.nodesSearched).toBeLessThanOrEqual(first.nodesSearched);
  });

  test("cancelled async bot request never applies a stale move", async () => {
    const state = createInitialState("classic", "cancel-bot");
    const pending = requestBotMove(state, "legend", { requestId: "cancel-me", delayMs: 25, maxSearchTimeMs: 80 });

    cancelBotMove("cancel-me");

    await expect(pending).resolves.toMatchObject({
      status: "cancelled",
      move: null,
      tier: "legend",
      engine: "internal",
      legal: false,
      legalValidated: false,
      validatedLegal: false
    });
  });

  test("internal search avoids an obviously hanging queen when a safe mate is available", () => {
    let state = createInitialState("classic", "queen-hanging");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[0][7].piece = { id: "black-rook", code: "r", owner: "black", labelKey: "chess.rook" };
    state.board[2][1].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[2][2].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    expect(chooseBotMove(state, "legend", { engine: "internal" })).toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
  });

  test("normal difficulty rescues an attacked major piece instead of drifting", () => {
    let state = createInitialState("classic", "queen-rescue");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[3][5].piece = { id: "black-knight", code: "n", owner: "black", labelKey: "chess.knight" };
    state.board[4][3].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[6][0].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const move = chooseBotMove(state, "normal", { engine: "internal", maxSearchTimeMs: 80 });

    expect(move.from).toEqual({ row: 4, col: 3 });
  });

  test("bot explanation names rescue decisions when a piece is attacked", async () => {
    let state = createInitialState("classic", "queen-rescue-explanation");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[3][5].piece = { id: "black-knight", code: "n", owner: "black", labelKey: "chess.knight" };
    state.board[4][3].piece = { id: "white-queen", code: "q", owner: "white", labelKey: "chess.queen" };
    state.board[6][0].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const result = await requestBotMove(state, "normal", { engine: "internal", maxSearchTimeMs: 80 });

    expect(result.explanation?.plan).toMatch(/rescues|counterattack/);
    expect(result.explanation?.risk).toContain("queen");
  });

  test("bot explanation reports capture trade safety", async () => {
    let state = createInitialState("classic", "trade-safety-explanation");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[0][0].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[2][4].piece = { id: "black-queen", code: "q", owner: "black", labelKey: "chess.queen" };
    state.board[3][3].piece = { id: "white-pawn", code: "p", owner: "white", labelKey: "chess.pawn" };
    state.board[7][7].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };

    const result = await requestBotMove(state, "normal", { engine: "internal", maxSearchTimeMs: 80 });

    expect(result.move).toMatchObject({ from: { row: 3, col: 3 }, to: { row: 2, col: 4 } });
    expect(result.explanation?.risk).toContain("Trade checked");
  });

  test("legend search values variant objectives beyond raw material", () => {
    let state = createInitialState("king-of-the-hill", "hill-objective");
    state = {
      ...state,
      board: state.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "white"
    };
    state.board[4][3].piece = { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" };
    state.board[7][7].piece = { id: "black-king", code: "k", owner: "black", labelKey: "chess.king" };
    state.board[5][7].piece = { id: "black-queen", code: "q", owner: "black", labelKey: "chess.queen" };

    expect(chooseBotMove(state, "legend", { engine: "internal" })).toMatchObject({ from: { row: 4, col: 3 }, to: { row: 3, col: 3 } });
  });

  test("async bot result exposes public benchmark fields", async () => {
    const state = createInitialState("classic", "public-bot-result");

    const result = await requestBotMove(state, "grandmaster", { engine: "internal", maxSearchTimeMs: 70 });

    expect(result).toMatchObject({
      status: "ok",
      tier: "grandmaster",
      strength: expect.objectContaining({
        display: "2700-2900 Elo-style",
        targetElo: 2850,
        calibrationStatus: "stockfish-calibrated"
      }),
      legal: true,
      knowledgeSource: "opening-book",
      benchmarkVersion: "allchess-knowledge-v1"
    });
    expect(result.depth).toBe(result.depthReached);
    expect(result.nodes).toBe(result.nodesSearched);
    expect(result.legalValidated).toBe(true);
    expect(result.pv).toEqual(result.principalVariation);
    expect(result.confidence).toBeGreaterThanOrEqual(0.82);
    expect(result.explanation?.plan).toContain("center");
  });

  test("knowledge layer validates cached moves before using them", async () => {
    const state = createInitialState("classic", "knowledge-start");
    const key = createBotPositionKey(state);
    const entries = listBotKnowledge("classic").filter((entry) => entry.positionKey === key);
    const hit = lookupBotKnowledge(state, "grandmaster");

    expect(entries.length).toBeGreaterThan(0);
    expect(hit?.entry.source).toBe("opening-book");
    expect(hit?.move).toMatchObject({ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } });

    const result = await requestBotMove(state, "grandmaster", { engine: "internal", maxSearchTimeMs: 70 });
    expect(result).toMatchObject({
      status: "ok",
      knowledgeSource: "opening-book",
      nodesSearched: 1,
      legalValidated: true,
      validatedLegal: true,
      searchEfficiency: { cacheHits: 0, cachedPositions: 0, moveGenerationCalls: 0, nodes: 1, transpositionEntries: 0, transpositionHits: 0 }
    });
  });

  test("seeded opening book gives every tier a fast non-naive first move", async () => {
    const state = createInitialState("classic", "easy-opening-book");
    const hit = lookupBotKnowledge(state, "easy");

    expect(hit?.entry).toEqual(
      expect.objectContaining({
        source: "opening-book",
        minTier: "easy"
      })
    );
    expect(hit?.move).toMatchObject({ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } });

    const startedAt = Date.now();
    const result = await requestBotMove(state, "easy", { engine: "auto", maxSearchTimeMs: MAX_BOT_REPLY_MS });

    expect(Date.now() - startedAt).toBeLessThan(150);
    expect(result).toMatchObject({
      status: "ok",
      tier: "easy",
      knowledgeSource: "opening-book",
      nodesSearched: 1,
      legalValidated: true
    });
  });

  test("verified playable variants have legal cache-first seed moves", async () => {
    const variants = ["classic", "chess960", "xiangqi", "antichess", "king-of-the-hill", "three-check"];

    for (const variantKey of variants) {
      const state = createInitialState(variantKey, `${variantKey}-seed`);
      const hit = lookupBotKnowledge(state, "easy");

      expect(hit?.entry).toEqual(expect.objectContaining({ minTier: "easy" }));
      expect(hit?.move).toBeTruthy();
      expect(() => applyMove(state, hit!.move)).not.toThrow();

      const startedAt = Date.now();
      const result = await requestBotMove(state, "easy", { engine: "auto", maxSearchTimeMs: MAX_BOT_REPLY_MS });

      expect(Date.now() - startedAt).toBeLessThan(150);
      expect(result).toMatchObject({
        status: "ok",
        knowledgeSource: "opening-book",
        nodesSearched: 1,
        legalValidated: true
      });
      expect(result.elapsedMs).toBeLessThan(MAX_BOT_REPLY_MS);
    }
  });

  test("knowledge cache uses indexed runtime lookups instead of linear scans", () => {
    const stats = getBotKnowledgeIndexStats();

    expect(stats.entries).toBeGreaterThan(0);
    expect(stats.positionKeys + stats.boardSignatures).toBeGreaterThan(0);
    expect(stats.maxBucketSize).toBeLessThan(stats.entries);
  });

  test("runtime language strategy keeps TypeScript orchestration with native hot paths", () => {
    const profile = getBotRuntimeLanguageProfile();

    expect(profile.primaryRuntime).toBe("typescript");
    expect(profile.hotPathStrategy).toBe("indexed-typescript-plus-wasm-engines");
    expect(profile.runtimeLanguages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: "TypeScript", status: "active" }),
        expect.objectContaining({ language: "WebAssembly/C++", status: "active" }),
        expect.objectContaining({ language: "Python", status: "offline" }),
        expect.objectContaining({ language: "Rust/WASM", status: "candidate" })
      ])
    );
    expect(profile.architectureBoundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ boundary: "interactive-runtime", runtime: "TypeScript" }),
        expect.objectContaining({ boundary: "engine-hot-path", runtime: "WebAssembly/C++" }),
        expect.objectContaining({ boundary: "offline-training", runtime: "Python" }),
        expect.objectContaining({ boundary: "future-kernel", runtime: "Rust/WASM" })
      ])
    );
    expect(profile.optimizationPolicy).toMatchObject({
      maxInteractiveBotReplyMs: 2800,
      cacheFirst: true,
      offlineTraining: true
    });
    expect(profile.cleanupFindings).toEqual(expect.arrayContaining([expect.stringContaining("duplicate verification table")]));
    expect(profile.migrationDecision.nextGate).toContain("benchmark");
  });

  test("board signatures support generated tactic-cache positions", () => {
    const state = createInitialState("classic", "signature-test");
    const signature = createBotBoardSignature(state);

    expect(signature).toContain("classic|turn:white|board:");
    expect(signature).toContain("wr");
    expect(signature).toContain("bk");
  });

  test("bot model manifests describe D1/R2 training artifacts", () => {
    const manifests = listBotModelManifests();

    expect(manifests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantKey: "classic",
          storage: "r2",
          benchmarkVersion: "allchess-local-knowledge-v1",
          status: "active"
        })
      ])
    );
    expect(manifests.find((manifest) => manifest.variantKey === "classic")?.positionCount).toBeGreaterThan(0);
  });

  test("local data generation exposes engine labels separately from runtime cache entries", () => {
    const summary = listBotKnowledgeSummary();
    const labels = listBotEngineLabels("classic");

    expect(summary.engineLabels).toBeGreaterThan(0);
    expect(summary.entries).toBeGreaterThanOrEqual(9000);
    expect(summary.openingEntries).toBeGreaterThanOrEqual(60);
    expect(summary.tacticEntries).toBeGreaterThanOrEqual(9000);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toEqual(
      expect.objectContaining({
        variantKey: "classic",
        moveUci: expect.any(String),
        legalValidation: "runtime",
        benchmarkVersion: "allchess-local-knowledge-v1"
      })
    );
  });

  test("local training manifests expose data and tool inventory without raw files", () => {
    const dataSources = listTrainingDataManifests();
    const tools = listBotToolManifests();

    expect(dataSources.length).toBeGreaterThan(0);
    expect(dataSources).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "csv", variantKey: "classic" })]));
    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Stockfish source", role: "engine-labeler" }),
        expect.objectContaining({ name: "Lc0 ONNX DirectML", role: "neural-engine-evaluator" }),
        expect.objectContaining({ name: "NNUE tools", role: "training-tooling" })
      ])
    );
  });

  test("training checklist covers every launch variant and every difficulty tier", () => {
    const checklists = listBotTrainingChecklists();
    const classic = checklists.find((checklist) => checklist.variantKey === "classic");
    const jungle = checklists.find((checklist) => checklist.variantKey === "jungle");
    const verifiedPlayable = ["classic", "chess960", "xiangqi", "antichess", "king-of-the-hill", "three-check"];

    expect(checklists.map((checklist) => checklist.variantKey)).toEqual(
      expect.arrayContaining(["classic", "chess960", "xiangqi", "shogi", "janggi", "makruk", "jungle", "antichess", "horde", "king-of-the-hill", "three-check"])
    );
    expect(classic?.coverageStatus).toBe("active");
    expect(classic?.rulesCompletion.status).toBe("verified-playable");
    expect(classic?.rulesCompletion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("bare kings")]));
    expect(classic?.difficultyTiers.map((tier) => tier.tier)).toEqual(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]);
    expect(classic?.difficultyTiers[0].targetBehavior).toContain("not naive");
    expect(classic?.difficultyTiers[0].strength.calibrationStatus).toBe("allchess-estimated");
    expect(classic?.difficultyTiers[1].strength.calibrationStatus).toBe("stockfish-calibrated");
    expect(classic?.difficultyTiers[0].checklist).toEqual(expect.arrayContaining([expect.objectContaining({ id: "not-naive-basics", status: "ready" })]));
    expect(classic?.difficultyTiers[0].checklist).toEqual(expect.arrayContaining([expect.objectContaining({ id: "resource-efficiency", status: "ready" })]));
    expect(classic?.difficultyTiers[0].checklist).toEqual(expect.arrayContaining([expect.objectContaining({ id: "search-telemetry", status: "ready" })]));
    expect(classic?.difficultyTiers[0].checklist).toEqual(expect.arrayContaining([expect.objectContaining({ id: "rule-completion", status: "ready" })]));
    expect(classic?.difficultyTiers[0].checklist).toEqual(expect.arrayContaining([expect.objectContaining({ id: "strength-calibration", status: "ready" })]));
    for (const variantKey of verifiedPlayable) {
      const checklist = checklists.find((item) => item.variantKey === variantKey);
      expect(checklist?.coverageStatus).toBe("active");
      expect(checklist?.knowledgeEntries).toBeGreaterThan(0);
      expect(checklist?.engineLabels).toBeGreaterThan(0);
      expect(checklist?.difficultyTiers.map((tier) => tier.search.maxMoveTimeMs)).toEqual([220, 420, 780, 1400, 2100, 2600]);
    }
    expect(jungle?.coverageStatus).toBe("rules-gated");
    expect(jungle?.rulesCompletion.verifiedEdgeCases).toEqual(expect.arrayContaining([expect.stringContaining("Rat river")]));
    expect(jungle?.rulesCompletion.remainingGates).toEqual(expect.arrayContaining([expect.stringContaining("E2E")]));
    expect(jungle?.difficultyTiers[0].checklist).toEqual(expect.arrayContaining([expect.objectContaining({ id: "rule-completion", status: "rules-gated" })]));
    expect(jungle?.difficultyTiers[0].strength.calibrationStatus).toBe("rules-gated");
    expect(jungle?.nextTrainingJobs[0]).toContain("Complete native jungle rules fixtures");
  });

  test("training gate summary does not claim unfinished variants are fully trained", () => {
    const summary = getBotTrainingGateSummary();

    expect(summary.claimPolicy).toBe("verified-playable-only");
    expect(summary.requiredCompletionGates).toEqual(expect.arrayContaining(["native rules", "legal bot moves", "review", "persistence", "E2E fixtures"]));
    expect(summary.playableVariants).toEqual(expect.arrayContaining(["classic", "chess960", "xiangqi", "antichess", "king-of-the-hill", "three-check"]));
    expect(summary.gatedVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantKey: "jungle",
          claim: "not-fully-trained",
          remainingGates: expect.arrayContaining([expect.stringContaining("E2E")])
        })
      ])
    );
    expect(summary.notice).toContain("guide-first previews");
  });
});
