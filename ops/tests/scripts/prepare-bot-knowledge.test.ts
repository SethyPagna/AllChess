import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, expect, test } from "vitest";
import { prepareBotKnowledge, refreshBotKnowledge } from "../../scripts/assets/prepare-bot-knowledge";
import { unpackBotKnowledge } from "@/lib/bot/knowledge-codec";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "allchess-packed-")); directories.push(directory);
  const source = join(directory, "source.json"), output = join(directory, "packed.json");
  return { source, output, document: { version: "test", entries: [{ move: "e2e4", explanation: { plan: "Develop" } }] } };
}

test("identical JSON content produces identical artifacts across checkout line endings", () => {
  const { source, output, document } = fixture();
  const json = JSON.stringify(document, null, 2);
  writeFileSync(source, json + "\n"); prepareBotKnowledge(source, output);
  const first = readFileSync(output, "utf8");
  writeFileSync(source, json.replaceAll("\n", "\r\n") + "\r\n"); prepareBotKnowledge(source, output);
  expect(readFileSync(output, "utf8")).toBe(first);
  expect(unpackBotKnowledge(JSON.parse(first))).toStrictEqual(document);
});

test("training the canonical source through a relative path refreshes its runtime artifact", () => {
  const { source, output, document } = fixture();
  writeFileSync(source, JSON.stringify(document));
  expect(refreshBotKnowledge(relative(process.cwd(), source), source, output)).toBe(true);
  expect(unpackBotKnowledge(JSON.parse(readFileSync(output, "utf8")))).toStrictEqual(document);
  document.entries[0].move = "d2d4"; writeFileSync(source, JSON.stringify(document));
  expect(refreshBotKnowledge(source, source, output)).toBe(true);
  expect(unpackBotKnowledge(JSON.parse(readFileSync(output, "utf8")))).toStrictEqual(document);
});

test("training a separate output preserves the canonical runtime artifact", () => {
  const { source, output, document } = fixture();
  writeFileSync(source, JSON.stringify(document)); prepareBotKnowledge(source, output);
  const before = readFileSync(output, "utf8"), other = output + ".training.json";
  writeFileSync(other, JSON.stringify({ entries: [] }));
  expect(refreshBotKnowledge(other, source, output)).toBe(false);
  expect(readFileSync(output, "utf8")).toBe(before);
});
