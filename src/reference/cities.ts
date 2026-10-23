/**
 * The cities and regions datasets, from GeoNames (CC BY 4.0): every city of 1,000 people or
 * more with its admin-1 code (data/reference/cities.tsv.gz), and each code's name
 * (admin1CodesASCII.txt.gz), both from one GeoNames day and kept current by
 * `npm run refresh`. A code GeoNames doesn't name takes a name from the dr5hn
 * countries-states-cities database (ODbL), matched by nearest centroid.
 *
 *   cities/top.json          the 10,000 most populous cities
 *   cities/all.json          every city (about 135,000)
 *   regions/regions.json     first-level regions, named
 *
 * Moved from Postcards' scripts/build-reference.mjs.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { REFERENCE_DIR, type Built } from "./common";

const require = createRequire(import.meta.url);

export interface CityRecord {
  id: string;
  name: string;
  countryIso2: string;
  subdivisionId: string | null;
  lat: number;
  lon: number;
  population: number | null;
}

export interface Subdivision {
  id: string;
  countryIso2: string;
  name: string;
}

/** The cities apps bundle and load at start-up; the rest is a download on demand. */
export const TOP_COUNT = 10_000;

// France: GeoNames names four of the 13 metropolitan regions in English ("Brittany"),
// so all 13 take their own French names, by INSEE region code.
const FR_REGION_NAMES: Record<string, string> = {
  11: "Île-de-France", 24: "Centre-Val de Loire", 27: "Bourgogne-Franche-Comté",
  28: "Normandie", 32: "Hauts-de-France", 44: "Grand Est", 52: "Pays de la Loire",
  53: "Bretagne", 75: "Nouvelle-Aquitaine", 76: "Occitanie", 84: "Auvergne-Rhône-Alpes",
  93: "Provence-Alpes-Côte d'Azur", 94: "Corse",
};

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function lines(file: string): string[][] {
  return gunzipSync(readFileSync(join(REFERENCE_DIR, file)))
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

export function buildCities(): Built {
  const { State } = require("country-state-city") as {
    State: { getStatesOfCountry(cc: string): { name: string; latitude: string | null; longitude: string | null }[] };
  };

  // GeoNames admin-1 names by "CC-code", from admin1CodesASCII.txt.
  const admin1Names = new Map(lines("admin1CodesASCII.txt.gz").map(([code = "", name = ""]) => [code.replace(".", "-"), name]));

  const statesByCountry = new Map<string, { name: string; lat: number; lon: number }[]>();
  const statesOf = (cc: string) => {
    let list = statesByCountry.get(cc);
    if (!list) {
      list = (State.getStatesOfCountry(cc) || [])
        .map((s) => ({ name: s.name, lat: parseFloat(s.latitude ?? ""), lon: parseFloat(s.longitude ?? "") }))
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && !(s.lat === 0 && s.lon === 0));
      statesByCountry.set(cc, list);
    }
    return list;
  };

  // Cities, each with its region code on the same GeoNames day as the names above. A line of
  // cities.tsv.gz: geonameid, name, country, admin-1 code, "u" for a city GeoNames no longer
  // lists (kept so its id still resolves), population (empty when unknown), latitude, longitude.
  const cities: (CityRecord & { unlisted?: boolean })[] = [];
  const seen = new Set<string>();
  for (const [id = "", name = "", country = "", admin1 = "", unlisted = "", population = "", lat = "", lon = ""] of lines("cities.tsv.gz")) {
    const la = Number(lat);
    const lo = Number(lon);
    if (!id || seen.has(id) || !lat || !lon || !Number.isFinite(la) || !Number.isFinite(lo)) continue;
    seen.add(id);
    cities.push({
      id,
      name,
      countryIso2: country,
      subdivisionId: admin1 ? `${country}-${admin1}` : null,
      lat: round4(la),
      lon: round4(lo),
      // GeoNames uses 0 for "unknown population": null, never a fake 0.
      population: Number(population) > 0 ? Number(population) : null,
      // Only a city GeoNames no longer lists falls back to its nearest neighbour.
      unlisted: unlisted === "u",
    });
  }
  const coded = new Map<string, CityRecord[]>();
  for (const c of cities) {
    if (!c.subdivisionId) continue;
    const list = coded.get(c.countryIso2) ?? [];
    list.push(c);
    coded.set(c.countryIso2, list);
  }
  for (const c of cities) {
    if (c.unlisted) {
      let best: CityRecord | null = null;
      let bestD = Infinity;
      for (const o of coded.get(c.countryIso2) ?? []) {
        const d = (o.lat - c.lat) ** 2 + (o.lon - c.lon) ** 2;
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      if (best) c.subdivisionId = best.subdivisionId;
    }
    delete c.unlisted;
  }

  const regions = new Map<string, { cc: string; adminCode: string; sumLat: number; sumLon: number; n: number }>();
  for (const c of cities) {
    if (!c.subdivisionId) continue;
    let r = regions.get(c.subdivisionId);
    if (!r) {
      r = { cc: c.countryIso2, adminCode: c.subdivisionId.slice(c.countryIso2.length + 1), sumLat: 0, sumLon: 0, n: 0 };
      regions.set(c.subdivisionId, r);
    }
    r.sumLat += c.lat;
    r.sumLon += c.lon;
    r.n++;
  }
  cities.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  const nearestName = (cc: string, lat: number, lon: number): string | null => {
    let best: string | null = null;
    let bestD = Infinity;
    for (const s of statesOf(cc)) {
      const d = (s.lat - lat) ** 2 + (s.lon - lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s.name;
      }
    }
    return best;
  };
  const subdivisions: Subdivision[] = [];
  for (const [id, r] of regions) {
    const name =
      (r.cc === "FR" ? FR_REGION_NAMES[r.adminCode] : undefined) ??
      admin1Names.get(id) ??
      nearestName(r.cc, r.sumLat / r.n, r.sumLon / r.n);
    subdivisions.push({ id, countryIso2: r.cc, name: name ?? `${r.cc} region ${r.adminCode}` });
  }
  subdivisions.sort((a, b) => a.id.localeCompare(b.id));

  return {
    files: [
      { path: "v1/cities/top.json", body: cities.slice(0, TOP_COUNT) },
      { path: "v1/cities/all.json", body: cities },
      { path: "v1/regions/regions.json", body: subdivisions },
    ],
    records: { cities: cities.length, regions: subdivisions.length },
  };
}
