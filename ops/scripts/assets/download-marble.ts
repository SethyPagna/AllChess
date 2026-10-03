import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// The pinned manifest records the artist's source revision, not a moving API result.
const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "ops/assets/classic/marble-source.json"), "utf8")) as {
  files: Record<string, { url: string; md5: string; size: number }>;
};
const destination = path.join(root, "output/playwright/polyhaven-chess");
for (const [name, file] of Object.entries(manifest.files)) {
  const target = path.resolve(destination, name);
  if (!target.startsWith(destination + path.sep)) throw new Error("Source path escapes download directory");
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== file.size || createHash("md5").update(bytes).digest("hex") !== file.md5) {
    throw new Error(`${name}: source checksum mismatch`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
console.log(`Verified source files in ${destination}`);
