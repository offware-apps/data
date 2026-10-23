/**
 * Build every dataset into public/v1/: places and stations from data/raw/wikidata.json
 * (see `npm run fetch`) or the file given as the first argument, and the rest from
 * src/reference/. `--offline` leaves out the one that is read from the network.
 * Run: npm run build [-- <wikidata.json>] [--offline]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildFiles } from "../src/places";
import { buildReference } from "../src/reference";
import type { Raw } from "../src/wikidata";

const args = process.argv.slice(2);
const input = resolve(args.find((a) => !a.startsWith("--")) ?? "data/raw/wikidata.json");
const raw = JSON.parse(readFileSync(input, "utf-8")) as Raw;
if (!Array.isArray(raw.cities) || raw.cities.length === 0) throw new Error(`no towns or cities in ${input}`);

const outDir = resolve("public");
rmSync(join(outDir, "v1"), { recursive: true, force: true });
const updatedAt = raw.fetchedAt ?? new Date().toISOString();
const reference = await buildReference(updatedAt, { network: !args.includes("--offline") });
const files = [...buildFiles(raw, updatedAt, reference.records), ...reference.files];
let bytes = 0;
for (const f of files) {
  const p = join(outDir, f.path);
  mkdirSync(dirname(p), { recursive: true });
  const text = JSON.stringify(f.body);
  bytes += text.length;
  writeFileSync(p, text, "utf-8");
}
const sights = Object.values(raw.sights).reduce((n, s) => n + s.length, 0);
const others = Object.entries(reference.records).map(([k, n]) => `${n} ${k}`).join(", ");
console.log(`[build] ${raw.cities.length} places, ${sights} sights, ${raw.stations?.length ?? 0} stations, ${others}; ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB in ${outDir}`);
