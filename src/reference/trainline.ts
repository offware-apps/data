/**
 * The European stations dataset: the Trainline EU open stations database (ODbL), about
 * 70,000 stations, read from GitHub at build time.
 *
 *   stations-europe/railways.json   in the same { _source, stations } shape as stations/railways.json
 *
 * Only stations a traveller can pick: city groupings, which sit on the city centre, and
 * airports are left out. Ids are "tl-" and Trainline's own id.
 *
 * Moved from Postcards' scripts/build-railways.mjs; the output is the same.
 */
import type { Built } from "./common";

export const TRAINLINE_CSV = "https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv";
const UA = "offware-data/0.1 (https://github.com/offware-apps/data)";

export interface TrainlineStation {
  id: string;
  name: string;
  countryIso2: string;
  subdivisionId: null;
  lat: number;
  lon: number;
}

/** Trainline's CSV is `;`-separated and unquoted in the columns read here. */
export function parseTrainline(text: string): TrainlineStation[] {
  const lines = text.split("\n");
  const header = (lines[0] ?? "").split(";");
  const col = (name: string): number => header.indexOf(name);
  const [iId, iName, iLat, iLon, iCc, iSugg, iCity, iAir] = ["id", "name", "latitude", "longitude", "country", "is_suggestable", "is_city", "is_airport"].map(col) as number[];
  const byId = new Map<string, TrainlineStation>();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const f = line.split(";");
    if (f[iSugg!] !== "t" || f[iCity!] === "t" || f[iAir!] === "t") continue;
    // An empty field is no coordinate, not 0.
    const lat = f[iLat!] ? Number(f[iLat!]) : NaN;
    const lon = f[iLon!] ? Number(f[iLon!]) : NaN;
    const cc = (f[iCc!] || "").trim().toUpperCase();
    const name = (f[iName!] || "").trim();
    if (!name || !/^[A-Z]{2}$/.test(cc) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = `tl-${f[iId!]}`;
    if (!byId.has(id)) byId.set(id, { id, name, countryIso2: cc, subdivisionId: null, lat, lon });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function trainlineFile(stations: TrainlineStation[], retrieved: string): unknown {
  return {
    _source: {
      dataset: "Trainline EU open stations database (railway stations)",
      url: "https://github.com/trainline-eu/stations",
      license: "ODbL-1.0",
      retrieved: retrieved.slice(0, 10),
      note: "Suggestable stations with coordinates; airports and city-grouping hubs excluded. Coverage is Europe-focused.",
      coverage: "europe",
    },
    stations,
  };
}

export async function buildTrainline(retrieved: string): Promise<Built> {
  const res = await fetch(TRAINLINE_CSV, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Trainline CSV: HTTP ${res.status}`);
  const stations = parseTrainline(await res.text());
  if (stations.length < 10_000) throw new Error(`Trainline CSV: only ${stations.length} stations`);
  return {
    files: [{ path: "v1/stations-europe/railways.json", body: trainlineFile(stations, retrieved) }],
    records: { "stations-europe": stations.length },
  };
}
