/**
 * Fetch towns, cities, their sights and railway stations from Wikidata to
 * data/raw/wikidata.json, which is committed: a full fetch takes about two hours, so it runs
 * monthly in its own workflow and the publish workflow builds from the saved copy. One
 * query per country for towns, one for the stations worldwide and their labels in batches,
 * then the sights in batches of cities, slowly enough to respect the query service's limits.
 * A country whose town query fails has its town ids read first, then their details in
 * batches; a batch of sights that fails is read in smaller batches. A country whose towns
 * still can't be read keeps what the last fetch had for it; whatever is left is left out and
 * named.
 * Run: npm run fetch [-- FR DE]   (default: every country)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  COUNTRIES_QUERY,
  COUNTRY_CODES_QUERY,
  STATIONS_QUERY,
  citiesByIdQuery,
  citiesQuery,
  keepPrevious,
  labelsQuery,
  nameStations,
  parseCities,
  parseCountries,
  parseCountryCodes,
  parseLabels,
  parseSights,
  parseStations,
  parseTownIds,
  sightsQuery,
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
/** Stations labelled per query: 10,000 took up to 44 s of the query service's 60. */
const LABEL_BATCH = 5_000;
/** A failed batch of sights is retried this many cities at a time. */
const SMALL_BATCH = 4;
/** FETCH_TRIES=1 makes a test run fail fast. */
const TRIES = Number(process.env.FETCH_TRIES) || 3;
/** Tries of a country's whole town query before its towns are read in batches. */
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

/** FETCH_IN_PARTS=1 skips a country's whole town query, to test reading in batches. */
const whole = (query: string, tries: number): Promise<unknown> =>
  process.env.FETCH_IN_PARTS === "1" ? Promise.reject(new Error("read in parts")) : sparql(query, tries);

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

// Every country's stations come from the same few queries, so one that keeps failing stops
// the run here, before the sights, rather than publish a copy without stations.
const codes = parseCountryCodes(await sparql(COUNTRY_CODES_QUERY));
await sleep(PAUSE_MS);
const stations = parseStations(await sparql(STATIONS_QUERY), codes, all);
const labels = new Map<string, string>();
for (let i = 0; i < stations.length; i += LABEL_BATCH) {
  await sleep(PAUSE_MS);
  const batch = await sparql(labelsQuery(stations.slice(i, i + LABEL_BATCH).map((s) => s.wikidata)));
  for (const [id, label] of parseLabels(batch)) labels.set(id, label);
}
raw.stations = nameStations(stations, labels);
if (raw.stations.length === 0) throw new Error("no railway station could be fetched from Wikidata");
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
if (noSights.length) console.log(`[fetch] towns without sights: ${noSights.length}`);
// A fetch with real holes would publish them: stop instead, and let the next run retry.
if (
  noTowns.length > MAX_MISSING_COUNTRIES ||
  missing.length > MAX_KEPT_COUNTRIES ||
  noSights.length > ids.length * MAX_MISSING_SIGHTS
) {
  console.error("[fetch] too much was left out to publish; nothing is published this run.");
  process.exit(1);
}
