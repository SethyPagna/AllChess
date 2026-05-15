import { describe, expect, test } from "vitest";

import { cancelBotMove, chooseBotMove, chooseBotMoveSafe, botDifficultyLevels, requestBotMove } from "@/lib/bots";
import {
  createBotBoardSignature,
  createBotPositionKey,
  getBotKnowledgeIndexStats,
  getBotRuntimeLanguageProfile,
  listBotEngineLabels,
  listBotKnowledge,
  listBotKnowledgeSummary,
  listBotModelManifests,
  listBotToolManifests,
  listTrainingDataManifests,
  lookupBotKnowledge
} from "@/lib/bot-training";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

describe("bot difficulty ladder", () => {
  test("defines the requested six difficulty levels in increasing search budget", () => {
    expect(botDifficultyLevels.map((level) => level.key)).toEqual(["easy", "normal", "hard", "very-hard", "grandmaster", "legend"]);
    expect(botDifficultyLevels.map((level) => level.label)).toEqual(["Easy", "Normal", "Hard", "Very Hard", "Grandmaster", "Legend"]);

    const budgets = botDifficultyLevels.map((level) => level.depth * level.moveTimeMs);
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets);
    expect(botDifficultyLevels.map((level) => level.beamWidth)).toEqual([4, 8, 14, 20, 32, 44]);
    expect(botDifficultyLevels.map((level) => level.quiescenceDepth)).toEqual([0, 0, 1, 1, 2, 4]);
    expect(botDifficultyLevels.map((level) => level.riskTolerance)).toEqual([0.85, 0.65, 0.45, 0.28, 0.12, 0.03]);
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

  test("difficulty changes strategy instead of only relabeling the same move", () => {
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

    expect(easy).not.toMatchObject({ from: { row: 2, col: 1 }, to: { row: 1, col: 1 } });
    expect(legend.to).toEqual({ row: 1, col: 1 });
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
    const state = createInitialState("classic", "async-bot");

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
      validatedLegal: true
    });
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
});
