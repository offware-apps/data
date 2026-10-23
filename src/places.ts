import { buildCatalog } from "./catalog";
import type { City, Raw, Sight, Station } from "./wikidata";

/**
 * The places and stations datasets: plain JSON files, so they can be hosted for free and
 * read by any app. Layout (all under /v1/):
 *
 *   places/index.json        every town and city, with the names it goes by
 *   places/<id>.json         one town or city: links to free guides, and its sights
 *   places/landmarks.json    every sight but UNESCO sites, in the shape Postcards' landmarks use
 *   places/pack.json         the sights as a Postcards community data pack
 *   stations/railways.json   railway stations worldwide, in the shape Postcards' stations use
 *   sources.json             where every value comes from, and under which licence
 *
 * Every record names its source: a Wikidata item, which is also where an error is fixed.
 * See docs/format.md.
 */

export const SOURCE = "Wikidata";
export const LICENSE = "CC0-1.0";
export const ATTRIBUTION = "Data from Wikidata (CC0). Guide links point to Wikivoyage and Wikipedia articles, which are CC BY-SA.";

/** The Wikidata page of an item: where its values come from, and where anyone can correct them. */
export const wikidataUrl = (id: string): string => `https://www.wikidata.org/wiki/${id}`;

import { SOURCES } from "./sources";

export { SOURCES };

export interface PlaceSight {
  wikidata: string;
  /** The Wikidata item this sight comes from, where it can also be corrected. */
  source: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  unesco?: true;
  wikipedia?: string;
}

export interface Place {
  id: string;
  name: string;
  countryIso2: string;
  wikidata: string;
  population: number;
  lat: number;
  lon: number;
  /** The Wikidata item this place comes from, where it can also be corrected. */
  source: string;
  links: { wikivoyage?: string; wikipedia?: string; website?: string };
  sights: PlaceSight[];
}

export interface PlacesIndex {
  version: 1;
  updatedAt: string;
  source: string;
  license: string;
  attribution: string;
  places: {
    id: string;
    name: string;
    names: string[];
    countryIso2: string;
    wikidata: string;
    population: number;
    lat: number;
    lon: number;
    sights: number;
  }[];
}

/** URL-safe id: accents folded, lowercase, dashes. "Saint-Étienne" → "saint-etienne". */
export function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Stable ids: the largest town of a name keeps the plain slug ("valence" is the larger
 * of Valence and Valencia's namesakes); a smaller namesake gets its country
 * ("valence-fr"), then a number.
 */
export function placeIds(cities: City[]): Map<string, string> {
  const ids = new Map<string, string>();
  // The dataset's own files share the folder: a town can't take their names.
  const used = new Set<string>(RESERVED_IDS);
  const order = [...cities].sort((a, b) => b.population - a.population || a.wikidata.localeCompare(b.wikidata));
  for (const c of order) {
    const base = slug(c.name) || c.wikidata.toLowerCase();
    const cc = c.countryIso2.toLowerCase();
    let id = used.has(base) ? `${base}-${cc}` : base;
    for (let k = 2; used.has(id); k++) id = `${base}-${cc}-${k}`;
    used.add(id);
    ids.set(c.wikidata, id);
  }
  return ids;
}

/** File names in v1/places/ that aren't a place. */
export const RESERVED_IDS = ["index", "landmarks", "pack"];

/** The most places a Postcards data pack may hold. */
export const PACK_MAX = 50_000;

const toSight = ({ sitelinks: _, ...s }: Sight): PlaceSight => {
  const { wikidata, ...rest } = s;
  return { wikidata, source: wikidataUrl(wikidata), ...rest };
};

/** Postcards' station shape: its loader reads `{ _source, stations }`. */
export function stationsFile(stations: Station[], retrieved: string): unknown {
  return {
    _source: {
      dataset: "Wikidata railway stations (instance of Q55488)",
      url: "https://www.wikidata.org",
      license: LICENSE,
      retrieved: retrieved.slice(0, 10),
      note: "Open mainline stations with coordinates and a UIC code or a Wikipedia (or other Wikimedia) page; most tram and metro stops are left out. Each station's id is its Wikidata item, where it can be corrected.",
      coverage: "worldwide",
    },
    stations: [...stations]
      .sort((a, b) => a.name.localeCompare(b.name) || a.wikidata.localeCompare(b.wikidata))
      .map((s) => ({ id: s.wikidata, name: s.name, countryIso2: s.countryIso2, subdivisionId: null, lat: s.lat, lon: s.lon })),
  };
}

/** `records` adds the record counts of datasets built elsewhere (src/reference/) to the catalog. */
export function buildFiles(raw: Raw, updatedAt: string, records: Record<string, number> = {}): { path: string; body: unknown }[] {
  const ids = placeIds(raw.cities);
  const cities = [...raw.cities].sort((a, b) => b.population - a.population || a.wikidata.localeCompare(b.wikidata));
  const files: { path: string; body: unknown }[] = [];
  const index: PlacesIndex = { version: 1, updatedAt, source: SOURCE, license: LICENSE, attribution: ATTRIBUTION, places: [] };
  // A sight inside two cities' areas is listed once, under the first (largest) city.
  const listed = new Set<string>();
  const landmarks: { id: string; name: string; countryIso2: string; lat: number; lon: number; category: string; sitelinks: number }[] = [];

  for (const c of cities) {
    const id = ids.get(c.wikidata)!;
    const sights = (raw.sights[c.wikidata] ?? []).map(toSight);
    const links: Place["links"] = {};
    if (c.wikivoyage) links.wikivoyage = c.wikivoyage;
    if (c.wikipedia) links.wikipedia = c.wikipedia;
    if (c.website) links.website = c.website;
    const place: Place = {
      id,
      name: c.name,
      countryIso2: c.countryIso2,
      wikidata: c.wikidata,
      population: c.population,
      lat: c.lat,
      lon: c.lon,
      source: wikidataUrl(c.wikidata),
      links,
      sights,
    };
    files.push({ path: `v1/places/${id}.json`, body: place });
    index.places.push({
      id,
      name: c.name,
      names: c.names,
      countryIso2: c.countryIso2,
      wikidata: c.wikidata,
      population: c.population,
      lat: c.lat,
      lon: c.lon,
      sights: sights.length,
    });
    for (const s of raw.sights[c.wikidata] ?? []) {
      if (listed.has(s.wikidata)) continue;
      // UNESCO sites stay out of landmarks.json: Postcards lists them from UNESCO's own list.
      if (s.unesco) continue;
      listed.add(s.wikidata);
      landmarks.push({ id: `wd-${s.wikidata}`, name: s.name, countryIso2: c.countryIso2, lat: s.lat, lon: s.lon, category: s.category, sitelinks: s.sitelinks });
    }
  }
  landmarks.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  files.push({ path: "v1/places/index.json", body: index });
  files.push({ path: "v1/sources.json", body: { version: 1, updatedAt, sources: SOURCES } });
  files.push({ path: "v1/catalog.json", body: buildCatalog(updatedAt, { ...records, places: cities.length, stations: raw.stations?.length ?? 0 }) });
  files.push({ path: "v1/stations/railways.json", body: stationsFile(raw.stations ?? [], updatedAt) });
  files.push({ path: "v1/places/landmarks.json", body: landmarks });
  files.push({
    path: "v1/places/pack.json",
    body: {
      format: "postcards-pack",
      version: 1,
      name: "Sights worldwide",
      description: "Museums, monuments, castles, palaces and parks in towns and cities worldwide. UNESCO World Heritage sites are left out, as Postcards lists them from UNESCO.",
      source: "https://www.wikidata.org",
      license: LICENSE,
      attribution: ATTRIBUTION,
      // Postcards takes at most PACK_MAX places of 120 characters a name: the best known are kept.
      places: [...landmarks]
        .sort((a, b) => b.sitelinks - a.sitelinks || a.id.localeCompare(b.id))
        .slice(0, PACK_MAX)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
        .map((l) => ({ id: l.id, name: l.name.slice(0, 120), lat: l.lat, lon: l.lon, countryIso2: l.countryIso2 })),
    },
  });
  return files;
}
