import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PACK_MAX, buildFiles, placeIds, slug, type Place, type PlacesIndex } from "../src/places";
import { citiesQuery, minPopulation, parseCities, parseCountries, parseSights, parseStations, point, sightsQuery, type Raw } from "../src/wikidata";

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8"));

const raw = (): Raw => {
  const cities = [...parseCities(fixture("cities-fr.json"), "FR"), ...parseCities(fixture("cities-es.json"), "ES")];
  return { fetchedAt: "2026-10-12T00:00:00.000Z", cities, sights: parseSights(fixture("sights.json")), stations: parseStations(fixture("stations.json")) };
};

describe("Wikidata results", () => {
  it("reads coordinates as lat, lon and rejects impossible ones", () => {
    expect(point("Point(2.351388888 48.856944444)")).toEqual({ lat: 48.85694, lon: 2.35139 });
    expect(point("Point(500 1)")).toBeNull();
    expect(point("garbage")).toBeNull();
  });

  it("keeps one row per city, the largest, and drops unnamed ones", () => {
    const cities = parseCities(fixture("cities-fr.json"), "FR");
    expect(cities.map((c) => c.name)).toEqual(["Paris", "Lyon", "Valence"]);
    const lyon = cities.find((c) => c.name === "Lyon")!;
    expect(lyon.population).toBe(522250);
    expect(lyon.wikivoyage).toBe("https://en.wikivoyage.org/wiki/Lyon");
    expect(cities[0]!.names).toEqual(["Paris", "Parigi", "Parijs"]);
  });

  it("keeps guide links only on the sites they belong to", () => {
    const valence = parseCities(fixture("cities-fr.json"), "FR").find((c) => c.name === "Valence")!;
    expect(valence.wikivoyage).toBeUndefined();
  });

  it("puts UNESCO sites first, then the best known, one entry per sight", () => {
    const sights = parseSights(fixture("sights.json"));
    expect(sights.Q90!.map((s) => s.name)).toEqual(["Notre-Dame de Paris", "Louvre", "Eiffel Tower"]);
    expect(sights.Q90![0]).toMatchObject({ unesco: true, category: "heritage site" });
    expect(sights.Q456!.map((s) => s.name)).toEqual(["Old Lyon"]);
  });

  it("reads countries and stations worldwide", () => {
    expect(parseCountries(fixture("countries.json"))).toEqual(["FR", "JP"]);
    expect(parseStations(fixture("stations.json"))).toEqual([
      { wikidata: "Q745942", name: "Paris Gare de Lyon", countryIso2: "FR", lat: 48.8443, lon: 2.3733 },
      { wikidata: "Q801124", name: "Tokyo Station", countryIso2: "JP", lat: 35.6812, lon: 139.7671 },
    ]);
  });

  it("keeps smaller towns in Europe than elsewhere", () => {
    expect(minPopulation("FR")).toBe(5000);
    expect(minPopulation("JP")).toBe(15000);
    expect(citiesQuery("JP")).toContain("?pop >= 15000");
  });

  it("builds queries for a country and a batch of cities", () => {
    expect(citiesQuery("FR")).toContain('wdt:P297 "FR"');
    expect(sightsQuery(["Q90", "Q456"])).toContain("VALUES ?city { wd:Q90 wd:Q456 }");
  });
});

describe("dataset files", () => {
  it("gives the larger namesake the plain id", () => {
    expect(slug("Saint-Étienne")).toBe("saint-etienne");
    const ids = placeIds([
      { wikidata: "Q2", name: "Valence", names: [], countryIso2: "FR", population: 64726, lat: 0, lon: 0 },
      { wikidata: "Q1", name: "Valence", names: [], countryIso2: "ES", population: 900000, lat: 0, lon: 0 },
    ]);
    expect(ids.get("Q1")).toBe("valence");
    expect(ids.get("Q2")).toBe("valence-fr");
  });

  it("writes an index, a file per place, the landmarks and a Postcards pack", () => {
    const files = buildFiles(raw(), "2026-10-12T00:00:00.000Z");
    const byPath = new Map(files.map((f) => [f.path, f.body]));
    const index = byPath.get("v1/index.json") as PlacesIndex;
    expect(index.license).toBe("CC0-1.0");
    expect(index.places.map((p) => p.id)).toEqual(["paris", "valencia", "lyon", "valence"]);

    const paris = byPath.get("v1/places/paris.json") as Place;
    expect(paris.source).toBe("https://www.wikidata.org/wiki/Q90");
    expect(paris.links).toEqual({
      wikivoyage: "https://en.wikivoyage.org/wiki/Paris",
      wikipedia: "https://en.wikipedia.org/wiki/Paris",
      website: "https://www.paris.fr/",
    });
    expect(paris.sights[0]).not.toHaveProperty("sitelinks");
    expect(paris.sights[0]!.source).toBe("https://www.wikidata.org/wiki/Q2981");

    const landmarks = byPath.get("v1/landmarks.json") as { id: string; countryIso2: string; category: string }[];
    // UNESCO sites (Notre-Dame, Old Lyon) are left to Postcards' own UNESCO list.
    expect(landmarks.map((l) => l.id)).toEqual(["wd-Q243", "wd-Q19675"]);
    expect(landmarks[0]).toEqual({ id: "wd-Q243", name: "Eiffel Tower", countryIso2: "FR", lat: 48.8584, lon: 2.2945, category: "monument", sitelinks: 180 });

    const pack = byPath.get("v1/pack.json") as { format: string; license: string; places: unknown[] };
    expect(pack.format).toBe("postcards-pack");
    expect(pack.license).toBe("CC0-1.0");
    expect(pack.places).toHaveLength(2);
    expect(PACK_MAX).toBe(50_000);

    const stations = byPath.get("v1/stations.json") as { _source: { license: string; coverage: string }; stations: { id: string; subdivisionId: null }[] };
    expect(stations._source).toMatchObject({ license: "CC0-1.0", coverage: "worldwide" });
    expect(stations.stations.map((s) => s.id)).toEqual(["Q745942", "Q801124"]);

    const sources = byPath.get("v1/sources.json") as { sources: { id: string; license: string }[] };
    expect(sources.sources.map((s) => `${s.id} ${s.license}`)).toEqual(["wikidata CC0-1.0", "wikivoyage CC-BY-SA-4.0", "wikipedia CC-BY-SA-4.0"]);
  });
});
