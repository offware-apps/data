/**
 * Look for a newer version of each saved source in data/reference/ and update the saved copy
 * when the part the build uses changed. One conditional request per source, no retries;
 * GeoNames only in the first week of the month (its files change daily), unless `--all`.
 * Anything that fails keeps the saved copy, and the script still exits 0: a refresh is a
 * comfort, never a reason for the weekly build to stop.
 * Run: npm run refresh [-- --all]
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { REFERENCE_DIR } from "../src/reference/common";
import {
  admin1Codes,
  citiesTsv,
  countriesJson,
  COUNTRIES_URL,
  GEONAMES,
  get,
  type Seen,
  UNESCO_EXPORT_URL,
  UNESCO_META_URL,
  unescoSites,
} from "../src/reference/refresh";

const LOCK = join(REFERENCE_DIR, "sources.lock.json");
const lock = (existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, "utf8")) : {}) as Record<string, Seen>;
const all = process.argv.includes("--all");
const report: string[] = [];

const gunzipped = (file: string) => gunzipSync(readFileSync(join(REFERENCE_DIR, file))).toString("utf8");
/** Writes a saved copy only when its text changed, so an unchanged source leaves no diff. */
function save(file: string, text: string): boolean {
  const path = join(REFERENCE_DIR, file);
  const gz = file.endsWith(".gz");
  if (existsSync(path) && (gz ? gunzipped(file) : readFileSync(path, "utf8")) === text) return false;
  writeFileSync(path, gz ? gzipSync(text, { level: 9 }) : text);
  return true;
}

async function step(name: string, run: () => Promise<string>) {
  try {
    report.push(`${name}: ${await run()}`);
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? `: ${err.cause.message}` : "";
    report.push(`${name}: kept the saved copy (${err instanceof Error ? err.message : String(err)}${cause})`);
  }
}

await step("GeoNames cities and regions", async () => {
  if (!all && new Date().getUTCDate() > 7) return "checked in the first week of the month";
  const citiesUrl = `${GEONAMES}cities1000.zip`;
  const admin1Url = `${GEONAMES}admin1CodesASCII.txt`;
  const cities = await get(citiesUrl, lock["geonames-cities"]);
  const admin1 = await get(admin1Url, lock["geonames-admin1"], 30_000);
  if (!cities && !admin1) return "not modified";

  // Both files are read from the same day, or neither is saved.
  const saved = gunzipped("cities.tsv.gz").split("\n").filter(Boolean).map((l) => l.split("\t"));
  let rows = saved;
  if (cities) {
    const dir = mkdtempSync(join(tmpdir(), "geonames-"));
    try {
      writeFileSync(join(dir, "cities1000.zip"), cities.body);
      const text = execFileSync("unzip", ["-p", join(dir, "cities1000.zip"), "cities1000.txt"], { maxBuffer: 1 << 28 }).toString("utf8");
      rows = citiesTsv(text, saved);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const savedAdmin1 = gunzipped("admin1CodesASCII.txt.gz").split("\n").filter(Boolean).length;
  const codes = admin1 ? admin1Codes(admin1.body.toString("utf8"), savedAdmin1) : null;

  const changed = [
    save("cities.tsv.gz", rows.map((r) => r.join("\t")).join("\n") + "\n") && `${rows.length} cities`,
    codes !== null && save("admin1CodesASCII.txt.gz", codes) && "region names",
  ].filter(Boolean);
  if (cities) lock["geonames-cities"] = cities.seen;
  if (admin1) lock["geonames-admin1"] = admin1.seen;
  return changed.length ? `updated (${changed.join(", ")})` : "downloaded, nothing used here changed";
});

await step("Countries", async () => {
  const res = await get(COUNTRIES_URL, lock.countries, 30_000);
  if (!res) return "not modified";
  const saved = (JSON.parse(readFileSync(join(REFERENCE_DIR, "countries.json"), "utf8")) as unknown[]).length;
  const countries = countriesJson(res.body.toString("utf8"), saved);
  const changed = save("countries.json", JSON.stringify(countries) + "\n");
  lock.countries = res.seen;
  return changed ? `updated (${countries.length} countries)` : "downloaded, nothing used here changed";
});

await step("UNESCO World Heritage List", async () => {
  // The dataset's own "modified" date first: the list itself is fetched only when it moved.
  const meta = await get(UNESCO_META_URL, undefined, 30_000);
  const info = JSON.parse(meta!.body.toString("utf8")) as { metas?: { default?: { modified?: string; data_processed?: string } } };
  const modified = info.metas?.default?.modified ?? info.metas?.default?.data_processed;
  if (!modified) throw new Error("no modified date in the dataset's metadata");
  if (lock.unesco?.modified === modified) return "not modified";
  const res = await get(UNESCO_EXPORT_URL, lock.unesco);
  if (!res) {
    lock.unesco = { ...lock.unesco!, modified };
    return "not modified";
  }
  const saved = (JSON.parse(gunzipped("whc-sites.json.gz")) as unknown[]).length;
  const known = JSON.parse(readFileSync(join(REFERENCE_DIR, "heritage-ids.json"), "utf8")) as Record<string, string>;
  const { sites, ids } = unescoSites(res.body.toString("utf8"), saved, known);
  const changed = save("whc-sites.json.gz", JSON.stringify(sites) + "\n");
  save("heritage-ids.json", JSON.stringify(ids, null, 2) + "\n");
  lock.unesco = { ...res.seen, modified };
  return changed ? `updated (${sites.length} sites)` : "downloaded, nothing used here changed";
});

writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
const summary = ["Source refresh", "", ...report.map((r) => `- ${r}`)].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n", { flag: "a" });
