import { deepStrictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { packBotKnowledge, unpackBotKnowledge, type PackedBotKnowledge } from "@/lib/bot/knowledge-codec";

describe("lossless bot knowledge delivery", () => {
  test("preserves every source entry and metadata field in the shipped artifact", () => {
    const source = readFileSync("src/data/bot-knowledge.generated.json");
    const original = JSON.parse(source.toString());
    const encoded = readFileSync("src/data/bot-knowledge.packed.json");
    const packed = JSON.parse(encoded.toString()) as PackedBotKnowledge;
    expect(packed.sourceContentSha256).toBe(createHash("sha256").update(JSON.stringify(original)).digest("hex"));
    deepStrictEqual(unpackBotKnowledge(packed), original);
    deepStrictEqual(packBotKnowledge(original, packed.sourceContentSha256), packed);
    expect(encoded.byteLength).toBeLessThan(Buffer.byteLength(JSON.stringify(original)) * .4);
  });

  test("preserves absent, null, zero, false, Unicode and arbitrary nested fields", () => {
    const original = JSON.parse('{"version":"test","entries":[{"id":"១","value":null,"zero":0,"enabled":false,"tags":[],"nested":{"__proto__":{"name":"own property"}}},{"id":"二","extra":{"line":["e2e4","e7e5"],"text":"♞"}}],"engineLabels":[{"evaluation":null,"bestMoves":[]}]}');
    const decoded = unpackBotKnowledge(packBotKnowledge(original, "test"));
    expect(decoded).toStrictEqual(original);
    expect(Object.hasOwn(decoded.entries[1], "value")).toBe(false);
    expect(Object.getPrototypeOf(decoded.entries[0].nested)).toBe(Object.prototype);
    expect(Object.hasOwn(decoded.entries[0].nested as object, "__proto__")).toBe(true);
  });

  test("does not introduce shared mutable tags, explanations or metadata", () => {
    const original = { entries: [{ tags: ["book"], explanation: { plan: "Develop" } }, { tags: ["book"], explanation: { plan: "Develop" } }], summary: { count: 2 } };
    const packed = packBotKnowledge(original, "test");
    const decoded = unpackBotKnowledge(packed);
    (decoded.entries[0].tags as string[]).push("changed");
    (decoded.entries[0].explanation as { plan: string }).plan = "Changed";
    (decoded.summary as { count: number }).count = 0;
    expect(decoded.entries[1]).toStrictEqual(original.entries[1]);
    expect(unpackBotKnowledge(packed)).toStrictEqual(original);
  });

  test("handles an empty training set", () => {
    expect(unpackBotKnowledge(packBotKnowledge({ entries: [], version: "empty" }, "test"))).toStrictEqual({ entries: [], version: "empty" });
  });

  test.each([-2, .5, 99])("rejects an invalid dictionary reference %s", reference => {
    const packed = packBotKnowledge({ entries: [{ move: "e2e4" }] }, "test");
    packed.rows[0][0] = reference;
    expect(() => unpackBotKnowledge(packed)).toThrow("Invalid bot knowledge");
  });

  test("rejects unsupported formats, duplicate columns and oversized rows", () => {
    const packed = packBotKnowledge({ entries: [{ move: "e2e4" }] }, "test");
    expect(() => unpackBotKnowledge({ ...packed, format: 2 } as unknown as PackedBotKnowledge)).toThrow("Invalid bot knowledge");
    expect(() => unpackBotKnowledge({ ...packed, columns: ["move", "move"] })).toThrow("Invalid bot knowledge");
    expect(() => unpackBotKnowledge({ ...packed, rows: [[0, 0]] })).toThrow("Invalid bot knowledge");
  });
});
