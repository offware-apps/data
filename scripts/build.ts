/**
 * Build the static dataset into public/v1/ from data/raw/wikidata.json (see `npm run fetch`),
 * or from the file given as the first argument.
 * Run: npm run build [-- <wikidata.json>]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildFiles } from "../src/places";
import type { Raw } from "../src/wikidata";

const input = resolve(process.argv[2] ?? "data/raw/wikidata.json");
const raw = JSON.parse(readFileSync(input, "utf-8")) as Raw;
if (!Array.isArray(raw.cities) || raw.cities.length === 0) throw new Error(`no towns or cities in ${input}`);

const outDir = resolve("public");
rmSync(join(outDir, "v1"), { recursive: true, force: true });
const files = buildFiles(raw, raw.fetchedAt ?? new Date().toISOString());
let bytes = 0;
for (const f of files) {
  const p = join(outDir, f.path);
  mkdirSync(dirname(p), { recursive: true });
  const text = JSON.stringify(f.body);
  bytes += text.length;
  writeFileSync(p, text, "utf-8");
}
const sights = Object.values(raw.sights).reduce((n, s) => n + s.length, 0);
console.log(`[build] ${raw.cities.length} places, ${sights} sights, ${raw.stations?.length ?? 0} stations, ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB in ${outDir}`);
