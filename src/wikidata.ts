/**
 * Everything read from Wikidata: the SPARQL queries and the parsers for their results.
 * Wikidata's data is CC0. Only Wikidata values and the URLs of Wikivoyage and Wikipedia
 * articles are kept: no article text, which is CC BY-SA, is ever copied.
 */

/**
 * Countries where small towns are kept too: the ones Europe's rail passes cover, where a
 * 5,000-people town can be a train stop worth a visit. Elsewhere the dataset keeps towns
 * from 15,000 people, like the GeoNames gazetteer Postcards bundles.
 */
export const EUROPE = new Set([
  "AT", "BA", "BE", "BG", "CH", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "ME", "MK", "NL", "NO", "PL", "PT", "RO",
  "RS", "SE", "SI", "SK", "TR", "MC", "LI", "AD", "SM", "MT", "CY", "IS", "AL", "XK",
]);

/** Towns and cities from this many people up. */
export function minPopulation(countryIso2: string): number {
  return EUROPE.has(countryIso2) ? 5000 : 15000;
}

/** Labels fetched for matching names, besides English. */
export const LANGS = ["en", "fr", "de", "es", "it", "nl", "pt", "ca", "sv", "nb", "da", "fi", "pl", "cs", "hu"];

export interface City {
  wikidata: string;
  name: string;
  /** Labels in the languages above, for matching station and place names. */
  names: string[];
  countryIso2: string;
  population: number;
  lat: number;
  lon: number;
  wikivoyage?: string;
  wikipedia?: string;
  website?: string;
}

export interface Sight {
  wikidata: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  /** Wikipedia language editions with an article: a rough measure of how well known it is. */
  sitelinks: number;
  unesco?: true;
  wikipedia?: string;
}

export interface Station {
  wikidata: string;
  name: string;
  countryIso2: string;
  lat: number;
  lon: number;
}

/** What `npm run fetch` saves to data/raw/wikidata.json, and `npm run build` reads. */
export interface Raw {
  fetchedAt: string;
  cities: City[];
  /** Sights per city, keyed by the city's Wikidata id. */
  sights: Record<string, Sight[]>;
  /** Railway stations worldwide. */
  stations: Station[];
}

// ---------------------------------------------------------------- queries

const labelService = `SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS.join(",")}" . }`;

/** Every country with an ISO 3166-1 code that still exists. */
export const COUNTRIES_QUERY = `SELECT DISTINCT ?iso2 WHERE {
  ?country wdt:P297 ?iso2 .
  FILTER NOT EXISTS { ?country wdt:P576 ?dissolved . }
}`;

export function parseCountries(result: unknown): string[] {
  const codes = bindings(result)
    .map((b) => b.iso2?.value?.toUpperCase() ?? "")
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return [...new Set(codes)].sort();
}

/** Towns and cities of one country with at least minPopulation() people. */
export function citiesQuery(countryIso2: string): string {
  return `SELECT ?city ?cityLabel ?pop ?coord ?voy ?wp ?site (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?names) WHERE {
  ?country wdt:P297 "${countryIso2}" .
  ?city wdt:P17 ?country ; wdt:P1082 ?pop ; wdt:P625 ?coord ; wdt:P31 ?cls .
  FILTER(?pop >= ${minPopulation(countryIso2)})
  ?cls wdt:P279* wd:Q486972 .
  OPTIONAL { ?city rdfs:label ?alt . FILTER(LANG(?alt) IN (${LANGS.map((l) => `"${l}"`).join(", ")})) }
  OPTIONAL { ?voy schema:about ?city ; schema:isPartOf <https://en.wikivoyage.org/> . }
  OPTIONAL { ?wp schema:about ?city ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?city wdt:P856 ?site . }
  ${labelService}
}
GROUP BY ?city ?cityLabel ?pop ?coord ?voy ?wp ?site`;
}

/** Kinds of sight, by Wikidata class. UNESCO World Heritage sites are kept whatever their class. */
export const SIGHT_CLASSES: [string, string][] = [
  ["Q33506", "museum"],
  ["Q207694", "museum"],
  ["Q2977", "cathedral"],
  ["Q16970", "church"],
  ["Q23413", "castle"],
  ["Q16560", "palace"],
  ["Q4989906", "monument"],
  ["Q22698", "park"],
  ["Q1107656", "garden"],
  ["Q174782", "square"],
  ["Q24354", "theatre"],
  ["Q12280", "bridge"],
];

/** Sights in a batch of cities (Wikidata ids), up to two administrative levels down. */
export function sightsQuery(cityIds: string[]): string {
  return `SELECT ?city ?item ?itemLabel ?category ?coord ?links ?unesco ?wp WHERE {
  VALUES ?city { ${cityIds.map((id) => `wd:${id}`).join(" ")} }
  ?item wdt:P131/wdt:P131? ?city ; wdt:P625 ?coord ; wikibase:sitelinks ?links .
  FILTER(?links >= 3)
  {
    VALUES (?cls ?category) { ${SIGHT_CLASSES.map(([c, t]) => `(wd:${c} "${t}")`).join(" ")} }
    ?item wdt:P31 ?cls .
  } UNION {
    ?item wdt:P757 ?whs . BIND("heritage site" AS ?category)
  }
  OPTIONAL { ?item wdt:P757 ?unesco . }
  OPTIONAL { ?wp schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  ${labelService}
}`;
}

// ---------------------------------------------------------------- results

type Binding = Record<string, { value: string } | undefined>;

/** Rows of a SPARQL JSON result. */
export function bindings(result: unknown): Binding[] {
  const rows = (result as { results?: { bindings?: unknown } } | null)?.results?.bindings;
  return Array.isArray(rows) ? (rows as Binding[]) : [];
}

const qid = (uri: string | undefined): string => (uri ? (uri.split("/").pop() ?? "") : "");

/** "Point(2.35 48.85)" → { lat: 48.85, lon: 2.35 }, or null when out of range. */
export function point(wkt: string | undefined): { lat: number; lon: number } | null {
  const m = /^Point\(\s*(-?[\d.]+(?:e-?\d+)?)\s+(-?[\d.]+(?:e-?\d+)?)\s*\)$/i.exec(wkt ?? "");
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  return { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
}

/** Only article URLs on the sites we expect, so a bad value can't smuggle in another link. */
function url(v: string | undefined, host?: RegExp): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (host && !host.test(u.hostname)) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

const VOY = /^en\.wikivoyage\.org$/;
const WP = /^en\.wikipedia\.org$/;

/** Cities from citiesQuery; when an id repeats (two populations or coordinates), the largest wins. */
export function parseCities(result: unknown, countryIso2: string): City[] {
  const byId = new Map<string, City>();
  for (const b of bindings(result)) {
    const id = qid(b.city?.value);
    const at = point(b.coord?.value);
    const name = b.cityLabel?.value?.trim() ?? "";
    if (!/^Q\d+$/.test(id) || !at || !name || name === id) continue;
    const names = (b.names?.value ?? "").split("|").map((n) => n.trim()).filter(Boolean);
    const city: City = {
      wikidata: id,
      name,
      names: [...new Set([name, ...names])],
      countryIso2,
      population: Math.round(Number(b.pop?.value)) || 0,
      ...at,
    };
    const voy = url(b.voy?.value, VOY);
    const wp = url(b.wp?.value, WP);
    const site = url(b.site?.value);
    if (voy) city.wikivoyage = voy;
    if (wp) city.wikipedia = wp;
    if (site) city.website = site;
    const seen = byId.get(id);
    if (!seen || seen.population < city.population) byId.set(id, city);
  }
  return [...byId.values()];
}

/** Sights kept per city, best known first. */
export const SIGHTS_PER_CITY = 15;

/** Sights from sightsQuery, grouped by city: UNESCO sites first, then the best known. */
export function parseSights(result: unknown): Record<string, Sight[]> {
  const byCity = new Map<string, Map<string, Sight>>();
  for (const b of bindings(result)) {
    const city = qid(b.city?.value);
    const id = qid(b.item?.value);
    const at = point(b.coord?.value);
    const name = b.itemLabel?.value?.trim() ?? "";
    if (!/^Q\d+$/.test(city) || !/^Q\d+$/.test(id) || !at || !name || name === id) continue;
    let sights = byCity.get(city);
    if (!sights) byCity.set(city, (sights = new Map()));
    const sight: Sight = sights.get(id) ?? {
      wikidata: id,
      name,
      category: b.category?.value ?? "sight",
      ...at,
      sitelinks: Number(b.links?.value) || 0,
    };
    // An item in several classes keeps the first; a UNESCO site is labelled as one.
    if (b.unesco?.value) {
      sight.unesco = true;
      if (b.category?.value === "heritage site") sight.category = "heritage site";
    }
    const wp = url(b.wp?.value, WP);
    if (wp && !sight.wikipedia) sight.wikipedia = wp;
    sights.set(id, sight);
  }
  const out: Record<string, Sight[]> = {};
  for (const [city, sights] of byCity) {
    out[city] = [...sights.values()]
      .sort((a, b) => Number(!!b.unesco) - Number(!!a.unesco) || b.sitelinks - a.sitelinks || a.name.localeCompare(b.name))
      .slice(0, SIGHTS_PER_CITY);
  }
  return out;
}

// ---------------------------------------------------------------- railway stations

/** Rows per page of the stations query. */
export const STATION_PAGE = 5000;

/**
 * Mainline railway stations worldwide that are still open, with coordinates and either
 * a UIC code or a Wikipedia article (which leaves out most tram and metro stops).
 */
export function stationsQuery(limit: number, offset: number): string {
  return `SELECT ?station ?stationLabel ?iso2 ?coord WHERE {
  ?station wdt:P31 wd:Q55488 ; wdt:P625 ?coord ; wdt:P17 ?country .
  ?country wdt:P297 ?iso2 .
  FILTER NOT EXISTS { ?station wdt:P576 ?closed . }
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q56556915 . }
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q45382883 . }
  FILTER( EXISTS { ?station wdt:P954 ?uic . }
          || EXISTS { ?article schema:about ?station ; schema:isPartOf ?wiki . FILTER(CONTAINS(STR(?wiki), "wikipedia.org")) } )
  ${labelService}
}
ORDER BY ?station
LIMIT ${limit} OFFSET ${offset}`;
}

/** Stations from one page of stationsQuery; a station in two countries keeps the first. */
export function parseStations(result: unknown): Station[] {
  const out: Station[] = [];
  const seen = new Set<string>();
  for (const b of bindings(result)) {
    const id = qid(b.station?.value);
    const at = point(b.coord?.value);
    const name = b.stationLabel?.value?.trim() ?? "";
    const cc = b.iso2?.value?.toUpperCase() ?? "";
    if (!/^Q\d+$/.test(id) || !at || !name || name === id || !/^[A-Z]{2}$/.test(cc) || seen.has(id)) continue;
    seen.add(id);
    out.push({ wikidata: id, name, countryIso2: cc, ...at });
  }
  return out;
}
