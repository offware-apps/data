/**
 * Vendor GeoNames' current admin-1 code for every city all-the-cities lists, so the cities
 * and regions datasets take codes and names from one GeoNames day (src/reference/cities.ts).
 * Run it with admin1CodesASCII.txt from the same day, gzipped into data/reference/.
 *
 *   curl -LO https://download.geonames.org/export/dump/cities500.zip && unzip cities500.zip
 *   curl -L https://download.geonames.org/export/dump/admin1CodesASCII.txt | gzip -9 > data/reference/admin1CodesASCII.txt.gz
 *   npm run city-admin1 -- cities500.txt
 *
 * Writes data/reference/city-admin1.tsv.gz: one "<geonameid>\t<CC>.<admin1>" line per city
 * cities500 still lists (CC BY 4.0, GeoNames).
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { REFERENCE_DIR } from "../src/reference/common";

const require = createRequire(import.meta.url);
const allCities = require("all-the-cities") as { cityId: number }[];

const source = process.argv[2];
if (!source) {
  console.error("usage: npm run city-admin1 -- <path to cities500.txt>");
  process.exit(1);
}

const wanted = new Set(allCities.map((c) => String(c.cityId)));
const rows: [number, string][] = [];
for (const line of readFileSync(source, "utf8").split("\n")) {
  const f = line.split("\t");
  if (f.length < 11 || !wanted.has(f[0]!)) continue;
  rows.push([Number(f[0]), `${f[0]}\t${f[8]}.${f[10]}`]);
}
rows.sort((a, b) => a[0] - b[0]);
writeFileSync(join(REFERENCE_DIR, "city-admin1.tsv.gz"), gzipSync(rows.map((r) => r[1]).join("\n") + "\n", { level: 9 }));
console.log(`cities with a current admin-1 code: ${rows.length} of ${wanted.size}`);
