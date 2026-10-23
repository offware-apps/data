/**
 * v1/catalog.json: every dataset this repository publishes, so an app, or whoever looks
 * after the apps, can see what exists, where it comes from, how fresh it is and who reads
 * it. A new dataset gets its own folder under v1/, an entry here, and its sources in
 * sources.json.
 */

export const BASE_URL = "https://offware-apps.github.io/data/v1";

export interface Dataset {
  id: string;
  name: string;
  description: string;
  license: string;
  /** Ids in sources.json. */
  sources: string[];
  /** When it is rebuilt. */
  schedule: string;
  /** The Offware apps that read it. */
  usedBy: string[];
  /** Paths under v1/. */
  files: { path: string; content: string }[];
}

export const DATASETS: Dataset[] = [
  {
    id: "places",
    name: "Towns, cities and sights",
    description: "Towns and cities worldwide (from 5,000 people in Europe, 15,000 elsewhere), with links to free travel guides and up to 15 sights each.",
    license: "CC0-1.0",
    sources: ["wikidata", "wikivoyage", "wikipedia"],
    schedule: "weekly",
    usedBy: ["postcards", "train-api"],
    files: [
      { path: "places/index.json", content: "every town and city, with the names it goes by" },
      { path: "places/<id>.json", content: "one town or city: guide links and sights" },
      { path: "places/landmarks.json", content: "every sight but UNESCO sites" },
      { path: "places/pack.json", content: "the sights as a Postcards data pack" },
    ],
  },
  {
    id: "stations",
    name: "Railway stations worldwide",
    description: "Open mainline railway stations with coordinates and a UIC code or a Wikipedia (or other Wikimedia) page.",
    license: "CC0-1.0",
    sources: ["wikidata"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [{ path: "stations/railways.json", content: "every station, in Postcards' station shape" }],
  },
  {
    id: "stations-europe",
    name: "Railway stations in Europe",
    description: "About 70,000 European stations a traveller can pick, from Trainline's open database. City groupings and airports are left out.",
    license: "ODbL-1.0",
    sources: ["trainline"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [{ path: "stations-europe/railways.json", content: "every station, in Postcards' station shape" }],
  },
  {
    id: "cities",
    name: "Cities worldwide",
    description: "Every city of 1,000 people or more GeoNames lists (about 135,000), with population, coordinates and first-level region.",
    license: "CC-BY-4.0",
    sources: ["geonames"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [
      { path: "cities/top.json", content: "the 10,000 most populous cities" },
      { path: "cities/all.json", content: "every city, most populous first" },
    ],
  },
  {
    id: "regions",
    name: "First-level regions",
    description: "The regions cities are in (states, provinces, French régions), by GeoNames admin-1 code, with their names.",
    license: "ODbL-1.0",
    sources: ["geonames", "dr5hn"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [{ path: "regions/regions.json", content: "every region: id, country, name" }],
  },
  {
    id: "airports",
    name: "Airports",
    description: "Every airport with an IATA code, with its city, country and coordinates.",
    license: "ODbL-1.0",
    sources: ["openflights"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [{ path: "airports/airports.json", content: "every airport, by IATA code" }],
  },
  {
    id: "heritage",
    name: "UNESCO World Heritage sites",
    description: "Every World Heritage site, once per country it is in.",
    license: "CC-BY-SA-3.0-IGO",
    sources: ["unesco-whc"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [{ path: "heritage/unesco.json", content: "every site: id, name, country, coordinates, category" }],
  },
  {
    id: "countries",
    name: "Countries",
    description: "Each country's common name, continent, spoken languages and UN membership, by ISO 3166-1 code.",
    license: "ODbL-1.0",
    sources: ["world-countries", "iso-3166"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [
      { path: "countries/names.json", content: "common English names" },
      { path: "countries/article-names.json", content: "Wikivoyage and Wikipedia article titles" },
      { path: "countries/continents.json", content: "continent of each country" },
      { path: "countries/languages.json", content: "spoken languages of each country" },
      { path: "countries/sovereignty.json", content: "UN member state or territory" },
    ],
  },
  {
    id: "moments",
    name: "Moments",
    description: "Travel experiences to collect, each tied to a place and citing where it comes from.",
    license: "CC0-1.0 AND CC-BY-4.0 AND CC-BY-SA-3.0-IGO AND CC-BY-SA-4.0",
    sources: ["wikidata", "geonames", "unesco-whc", "unesco-ich", "wikivoyage"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [{ path: "moments/moments.json", content: "every moment, with the sources of each" }],
  },
];

export interface Catalog {
  version: 1;
  baseUrl: string;
  updatedAt: string;
  datasets: (Dataset & { updatedAt: string; records: number })[];
}

/** The catalog, with each dataset's build time and record count. */
export function buildCatalog(updatedAt: string, records: Record<string, number>): Catalog {
  return {
    version: 1,
    baseUrl: BASE_URL,
    updatedAt,
    datasets: DATASETS.map((d) => ({ ...d, updatedAt, records: records[d.id] ?? 0 })),
  };
}
