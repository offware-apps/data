/**
 * Fetch towns, cities, their sights and railway stations from Wikidata to
 * data/raw/wikidata.json, which is committed: a full fetch takes about two hours, so it runs
 * monthly in its own workflow and the publish workflow builds from the saved copy. One
 * query per country for towns and for stations, then the sights in batches of cities,
 * slowly enough to respect the query service's limits. A country whose query fails has its
 * town ids read first, then their details in batches, and its stations read in parts; a
 * batch of sights that fails is read in smaller batches. A country that still can't be read
 * keeps what the last fetch had for it; whatever is left is left out and named.
 * Run: npm run fetch [-- FR DE]   (default: every country)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  COUNTRIES_QUERY,
  citiesByIdQuery,
  citiesQuery,
  keepPrevious,
  parseCities,
  parseCountries,
  parseSights,
  parseStations,
  parseTownIds,
  PARTS,
  sightsQuery,
  stationsQuery,
  townIdsQuery,
  type City,
  type Raw,
} from "../src/wikidata";

const ENDPOINT = "https://query.wikidata.org/sparql";
// Wikidata asks every client to name itself and give a contact.
const USER_AGENT = "offware-data/0.1 (https://github.com/offware-apps/data)";
const OUT = resolve("data/raw/wikidata.json");
const BATCH = 20;
/** Towns whose details are read in one query, for a country read in batches. */
const TOWN_BATCH = 500;
/** A failed batch of sights is retried this many cities at a time. */
const SMALL_BATCH = 4;
/** FETCH_TRIES=1 makes a test run fail fast. */
const TRIES = Number(process.env.FETCH_TRIES) || 3;
/** Tries of a country's whole query before it is read in parts or batches. */
const WHOLE_TRIES = Math.min(TRIES, 2);
const PAUSE_MS = 1_000;
/** Tiny territories time out now and then; more than this many missing countries fails the run. */
const MAX_MISSING_COUNTRIES = 2;
/** More countries than this kept from the last fetch means the query service or a query is broken: fail the run. */
const MAX_KEPT_COUNTRIES = 10;
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

/** FETCH_IN_PARTS=1 skips a country's whole query, to test reading in parts and batches. */
const whole = (query: string, tries: number): Promise<unknown> =>
  process.env.FETCH_IN_PARTS === "1" ? Promise.reject(new Error("read in parts")) : sparql(query, tries);

/** A country too large for one query, read one part at a time. */
async function inParts<T>(what: string, query: (digits: string) => string, parse: (result: unknown) => T[]): Promise<T[]> {
  log(`${what}: reading in ${PARTS.length} parts`);
  const out: T[] = [];
  for (const digits of PARTS) {
    await sleep(PAUSE_MS);
    out.push(...parse(await sparql(query(digits))));
  }
  return out;
}

/** A country with too many towns for one query: their ids first, then their details in batches. */
async function townsInBatches(cc: string): Promise<City[]> {
  const ids = parseTownIds(await sparql(townIdsQuery(cc)));
  log(`${cc} towns: reading ${ids.length} in batches of ${TOWN_BATCH}`);
  const out: City[] = [];
  for (let i = 0; i < ids.length; i += TOWN_BATCH) {
    await sleep(PAUSE_MS);
    out.push(...parseCities(await sparql(citiesByIdQuery(ids.slice(i, i + TOWN_BATCH))), cc));
  }
  return out;
}

/** The last fetch, committed: a country this run can't read keeps what it had there. */
const previous = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf-8")) as Raw) : null;

const missing: string[] = [];
for (const cc of all) {
  try {
    // The quick way first; a country too large for it is read the slow, sure way, and in
    // batches when even that times out.
    const cities = await whole(citiesQuery(cc), 1)
      .catch(() => whole(citiesQuery(cc, true), WHOLE_TRIES))
      .then((result) => parseCities(result, cc))
      .catch(() => townsInBatches(cc));
    raw.cities.push(...cities);
    log(`${cc}: ${cities.length} towns and cities`);
  } catch (err) {
    missing.push(cc);
    console.error(`[fetch] ${cc}: towns left out (${String(err)})`);
  }
  await sleep(PAUSE_MS);
}
if (raw.cities.length === 0) throw new Error("no town or city could be fetched from Wikidata");
const noTowns = keepPrevious(missing, raw.cities, previous?.cities ?? [], "towns and cities", log);

const missingStations: string[] = [];
const seen = new Set<string>();
for (const cc of all) {
  try {
    const found = await whole(stationsQuery(cc), WHOLE_TRIES)
      .then(parseStations)
      .catch(() => inParts(`${cc} stations`, (digits) => stationsQuery(cc, digits), parseStations));
    const stations = found.filter((s) => !seen.has(s.wikidata));
    for (const s of stations) seen.add(s.wikidata);
    raw.stations.push(...stations);
    if (stations.length) log(`${cc}: ${stations.length} railway stations`);
  } catch (err) {
    missingStations.push(cc);
    console.error(`[fetch] ${cc}: stations left out (${String(err)})`);
  }
  await sleep(PAUSE_MS);
}
const noStations = keepPrevious(missingStations, raw.stations, (previous?.stations ?? []).filter((s) => !seen.has(s.wikidata)), "railway stations", log);
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
if (noTowns.length) console.log(`[fetch] countries without towns: ${noTowns.join(" ")}`);
if (noStations.length) console.log(`[fetch] countries without stations: ${noStations.join(" ")}`);
if (noSights.length) console.log(`[fetch] towns without sights: ${noSights.length}`);
// A fetch with real holes would publish them: stop instead, and let the next run retry.
if (
  noTowns.length > MAX_MISSING_COUNTRIES ||
  noStations.length > MAX_MISSING_COUNTRIES ||
  missing.length > MAX_KEPT_COUNTRIES ||
  missingStations.length > MAX_KEPT_COUNTRIES ||
  noSights.length > ids.length * MAX_MISSING_SIGHTS
) {
  console.error("[fetch] too much was left out to publish; nothing is published this run.");
  process.exit(1);
}
