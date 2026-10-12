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
    description: "Open mainline railway stations with coordinates and a UIC code or a Wikipedia article.",
    license: "CC0-1.0",
    sources: ["wikidata"],
    schedule: "weekly",
    usedBy: ["postcards"],
    files: [{ path: "stations/railways.json", content: "every station, in Postcards' station shape" }],
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
