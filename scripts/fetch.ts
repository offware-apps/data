/**
 * Fetch towns, cities, their sights and railway stations from Wikidata to
 * data/raw/wikidata.json (git-ignored). One query per country for towns and for stations,
 * then the sights in batches of cities, slowly enough to respect the query service's
 * limits. A batch that fails is retried in smaller ones; whatever keeps failing is left
 * out and named.
 * Run: npm run fetch [-- FR DE]   (default: every country)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  COUNTRIES_QUERY,
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
const USER_AGENT = "offware-data/0.1 (https://github.com/offware-apps/data)";
const OUT = resolve("data/raw/wikidata.json");
const BATCH = 20;
/** A failed batch of sights is retried this many cities at a time. */
const SMALL_BATCH = 4;
/** FETCH_TRIES=1 makes a test run fail fast. */
const TRIES = Number(process.env.FETCH_TRIES) || 3;
const PAUSE_MS = 1_000;
/** Tiny territories time out now and then; more than this many missing countries fails the run. */
const MAX_MISSING_COUNTRIES = 2;
/** Share of towns whose sights may be missing before the run fails. */
const MAX_MISSING_SIGHTS = 0.01;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const log = (msg: string): void => console.log(`[fetch +${Math.round((Date.now() - started) / 60_000)} min] ${msg}`);

async function sparql(query: string, tries = TRIES): Promise<unknown> {
  let last: unknown;
  for (let i = 1; i <= tries; i++) {
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
      console.error(`[fetch] attempt ${i}/${tries} failed: ${String(err)}`);
      const wait = typeof (err as Error).cause === "number" ? ((err as Error).cause as number) * 1000 : 5_000 * i;
      if (i < tries) await sleep(wait);
    }
  }
  throw last;
}

const countries = process.argv.slice(2).filter((c) => /^[A-Z]{2}$/.test(c));
const raw: Raw = { fetchedAt: new Date().toISOString(), cities: [], sights: {}, stations: [] };
const all = countries.length ? countries : parseCountries(await sparql(COUNTRIES_QUERY));
log(`${all.length} countries`);

const missing: string[] = [];
for (const cc of all) {
  try {
    // The quick way first; a country too large for it is read the slow, sure way.
    const result = await sparql(citiesQuery(cc), 1).catch(() => sparql(citiesQuery(cc, true)));
    const cities = parseCities(result, cc);
    raw.cities.push(...cities);
    log(`${cc}: ${cities.length} towns and cities`);
  } catch (err) {
    missing.push(cc);
    console.error(`[fetch] ${cc}: towns left out (${String(err)})`);
  }
  await sleep(PAUSE_MS);
}
if (raw.cities.length === 0) throw new Error("no town or city could be fetched from Wikidata");

const missingStations: string[] = [];
const seen = new Set<string>();
for (const cc of all) {
  try {
    const stations = parseStations(await sparql(stationsQuery(cc))).filter((s) => !seen.has(s.wikidata));
    for (const s of stations) seen.add(s.wikidata);
    raw.stations.push(...stations);
    if (stations.length) log(`${cc}: ${stations.length} railway stations`);
  } catch (err) {
    missingStations.push(cc);
    console.error(`[fetch] ${cc}: stations left out (${String(err)})`);
  }
  await sleep(PAUSE_MS);
}
log(`${raw.stations.length} railway stations`);

/** Sights of a batch of towns; a batch that fails is tried again a few towns at a time. */
async function sights(ids: string[]): Promise<string[]> {
  try {
    Object.assign(raw.sights, parseSights(await sparql(sightsQuery(ids))));
    return [];
  } catch (err) {
    if (ids.length <= SMALL_BATCH) {
      console.error(`[fetch] sights of ${ids.join(" ")} left out (${String(err)})`);
      return ids;
    }
    const failed: string[] = [];
    for (let i = 0; i < ids.length; i += SMALL_BATCH) {
      await sleep(PAUSE_MS);
      failed.push(...(await sights(ids.slice(i, i + SMALL_BATCH))));
    }
    return failed;
  }
}

const ids = raw.cities.map((c) => c.wikidata);
const noSights: string[] = [];
for (let i = 0; i < ids.length; i += BATCH) {
  noSights.push(...(await sights(ids.slice(i, i + BATCH))));
  if ((i / BATCH) % 50 === 0) log(`sights: ${Math.min(i + BATCH, ids.length)} of ${ids.length} towns`);
  await sleep(PAUSE_MS);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(raw), "utf-8");
const sightCount = Object.values(raw.sights).reduce((n, s) => n + s.length, 0);
log(`${raw.cities.length} towns and cities, ${sightCount} sights, ${raw.stations.length} stations → ${OUT}`);
if (missing.length) console.log(`[fetch] countries without towns: ${missing.join(" ")}`);
if (missingStations.length) console.log(`[fetch] countries without stations: ${missingStations.join(" ")}`);
if (noSights.length) console.log(`[fetch] towns without sights: ${noSights.length}`);
// A fetch with real holes would publish them: stop instead, and let the next run retry.
if (
  missing.length > MAX_MISSING_COUNTRIES ||
  missingStations.length > MAX_MISSING_COUNTRIES ||
  noSights.length > ids.length * MAX_MISSING_SIGHTS
) {
  console.error("[fetch] too much was left out to publish; nothing is published this run.");
  process.exit(1);
}
