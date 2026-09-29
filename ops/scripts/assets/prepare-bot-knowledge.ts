import { deepStrictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packBotKnowledge, unpackBotKnowledge } from "../../../src/lib/bot/knowledge-codec.ts";

const canonicalSource = fileURLToPath(new URL("../../../src/data/bot-knowledge.generated.json", import.meta.url));
const canonicalOutput = fileURLToPath(new URL("../../../src/data/bot-knowledge.packed.json", import.meta.url));

export function prepareBotKnowledge(
  sourcePath = canonicalSource,
  outputPath = canonicalOutput
) {
  const source = readFileSync(sourcePath), document = JSON.parse(source.toString());
  const packed = packBotKnowledge(document, createHash("sha256").update(JSON.stringify(document)).digest("hex"));
  deepStrictEqual(unpackBotKnowledge(packed), document);
  const encoded = JSON.stringify(packed) + "\n";
  writeFileSync(outputPath, encoded);
  console.log(`Prepared ${document.entries.length} bot entries: ${Buffer.byteLength(encoded)} bytes; all source fields preserved.`);
}

export function refreshBotKnowledge(changedPath: string, sourcePath = canonicalSource, outputPath = canonicalOutput) {
  if (realpathSync(changedPath) !== realpathSync(sourcePath)) return false;
  prepareBotKnowledge(sourcePath, outputPath);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareBotKnowledge();
