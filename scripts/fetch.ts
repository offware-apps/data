/**
 * Fetch towns, cities, their sights and railway stations from Wikidata to
 * data/raw/wikidata.json (git-ignored). One query per country, then the sights in batches
 * of cities, then the stations page by page, slowly enough to respect the query service's
 * limits. A country, batch or page that keeps failing is left out and named.
 * Run: npm run fetch [-- FR DE]   (default: every country)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  COUNTRIES_QUERY,
  STATION_PAGE,
  bindings,
  citiesQuery,
  parseCities,
  parseCountries,
  parseSights,
  parseStations,
  sightsQuery,
  stationsQuery,
  type Raw,
} from "../src/wikidata";

const ENDPOINT = "https://query.wikidata.org/sparql";
// Wikidata asks every client to name itself and give a contact.
const USER_AGENT = "offware-places/0.1 (https://github.com/offware-apps/places)";
const OUT = resolve("data/raw/wikidata.json");
const BATCH = 50;
const TRIES = 3;
const PAUSE_MS = 1_000;
/** Tiny territories time out now and then; more than this many missing countries fails the run. */
const MAX_MISSING_COUNTRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sparql(query: string): Promise<unknown> {
  let last: unknown;
  for (let i = 1; i <= TRIES; i++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/sparql-results+json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ query }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after")) || 30;
        throw new Error(`HTTP 429, retry after ${wait} s`, { cause: wait });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      console.error(`[fetch] attempt ${i}/${TRIES} failed: ${String(err)}`);
      const wait = typeof (err as Error).cause === "number" ? ((err as Error).cause as number) * 1000 : 5_000 * i;
      if (i < TRIES) await sleep(wait);
    }
  }
  throw last;
}

const countries = process.argv.slice(2).filter((c) => /^[A-Z]{2}$/.test(c));
const raw: Raw = { fetchedAt: new Date().toISOString(), cities: [], sights: {}, stations: [] };
const missing: string[] = [];
const all = countries.length ? countries : parseCountries(await sparql(COUNTRIES_QUERY));
console.log(`[fetch] ${all.length} countries`);

for (const cc of all) {
  try {
    const cities = parseCities(await sparql(citiesQuery(cc)), cc);
    raw.cities.push(...cities);
    console.log(`[fetch] ${cc}: ${cities.length} towns and cities`);
  } catch (err) {
    missing.push(cc);
    console.error(`[fetch] ${cc}: left out (${String(err)})`);
  }
  await sleep(PAUSE_MS);
}
if (raw.cities.length === 0) throw new Error("no town or city could be fetched from Wikidata");

const ids = raw.cities.map((c) => c.wikidata);
let failedBatches = 0;
for (let i = 0; i < ids.length; i += BATCH) {
  try {
    Object.assign(raw.sights, parseSights(await sparql(sightsQuery(ids.slice(i, i + BATCH)))));
  } catch (err) {
    failedBatches++;
    console.error(`[fetch] sights for cities ${i}–${i + BATCH} left out (${String(err)})`);
  }
  await sleep(PAUSE_MS);
}

// Stations worldwide (or only in the countries asked for), a page at a time.
const wanted = new Set(all);
const seen = new Set<string>();
let failedPages = 0;
for (let offset = 0; ; offset += STATION_PAGE) {
  let result: unknown;
  try {
    result = await sparql(stationsQuery(STATION_PAGE, offset));
  } catch (err) {
    failedPages++;
    console.error(`[fetch] stations from ${offset} left out (${String(err)})`);
    if (failedPages >= 3) break;
    continue;
  }
  for (const s of parseStations(result)) {
    if (!wanted.has(s.countryIso2) || seen.has(s.wikidata)) continue;
    seen.add(s.wikidata);
    raw.stations.push(s);
  }
  if (bindings(result).length < STATION_PAGE) break;
  await sleep(PAUSE_MS);
}
console.log(`[fetch] ${raw.stations.length} railway stations`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(raw), "utf-8");
const sightCount = Object.values(raw.sights).reduce((n, s) => n + s.length, 0);
console.log(`[fetch] ${raw.cities.length} towns and cities, ${sightCount} sights → ${OUT}`);
if (missing.length) console.log(`[fetch] countries left out: ${missing.join(" ")}`);
if (failedBatches) console.log(`[fetch] sight batches left out: ${failedBatches}`);
if (failedPages) console.log(`[fetch] station pages left out: ${failedPages}`);
// A partial fetch would publish a dataset with holes: stop instead, and let the next run retry.
if (missing.length > MAX_MISSING_COUNTRIES || failedBatches > 0 || failedPages > 0) {
  console.error("[fetch] too much was left out to publish; nothing is published this run.");
  process.exit(1);
}
