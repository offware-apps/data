import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCities, type CityRecord, type Subdivision } from "../src/reference/cities";
import { REFERENCE_DIR } from "../src/reference/common";
import { buildCountries } from "../src/reference/countries";
import { plainName } from "../src/reference/heritage";
import { buildMoments } from "../src/reference/moments";
import { parseTrainline, trainlineFile } from "../src/reference/trainline";

describe("reference datasets", () => {
  it("keeps only Trainline stations a traveller can pick", () => {
    const csv = [
      "id;name;slug;uic;latitude;longitude;parent_station_id;country;time_zone;is_city;is_main_station;is_airport;is_suggestable",
      "1;Paris Gare de Lyon;paris-gare-de-lyon;8768600;48.844;2.373;4916;fr;Europe/Paris;f;t;f;t",
      "4916;Paris;paris;;48.85;2.35;;FR;Europe/Paris;t;f;f;t",
      "2;Paris CDG Airport;cdg;;49.0;2.55;;FR;Europe/Paris;f;f;t;t",
      "3;Hidden;hidden;;48.0;2.0;;FR;Europe/Paris;f;f;f;f",
      "5;No coordinates;none;;;;;FR;Europe/Paris;f;f;f;t",
      "1;Paris Gare de Lyon;paris-gare-de-lyon;8768600;48.844;2.373;4916;FR;Europe/Paris;f;t;f;t",
    ].join("\n");
    const stations = parseTrainline(csv);
    expect(stations).toEqual([{ id: "tl-1", name: "Paris Gare de Lyon", countryIso2: "FR", subdivisionId: null, lat: 48.844, lon: 2.373 }]);
    expect(trainlineFile(stations, "2026-10-23T03:00:00Z")).toMatchObject({ _source: { license: "ODbL-1.0", retrieved: "2026-10-23", coverage: "europe" } });
  });

  it("makes UNESCO site names plain text", () => {
    expect(plainName("Historic <em>Centre</em> of Rome &amp; the Holy See&#8217;s  sites")).toBe("Historic Centre of Rome & the Holy See’s sites");
  });

  it("counts the Holy See as a territory, as the UN does", () => {
    const sovereignty = buildCountries().files.find((f) => f.path === "v1/countries/sovereignty.json")!.body as Record<string, string>;
    expect(sovereignty.VA).toBe("territory");
    expect(sovereignty.FR).toBe("un");
    expect(Object.values(sovereignty).filter((v) => v === "un")).toHaveLength(193);
  });

  it("publishes the moments as written", () => {
    const built = buildMoments();
    expect(built.records.moments).toBeGreaterThan(100);
    expect(built.files[0]!.path).toBe("v1/moments/moments.json");
  });

  describe("cities and regions", () => {
    const built = buildCities();
    const file = <T>(path: string): T => built.files.find((f) => f.path === path)!.body as T;
    const cities = file<CityRecord[]>("v1/cities/all.json");
    const regions = new Map(file<Subdivision[]>("v1/regions/regions.json").map((r) => [r.id, r.name]));
    // Both vendored files are one GeoNames day: each city's region code and each code's
    // name. Mixing days put Hanoi under "Quang Tri" when Vietnam renumbered in 2025.
    const vendored = (name: string) =>
      new Map(
        gunzipSync(readFileSync(join(REFERENCE_DIR, name)))
          .toString("utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => line.split("\t") as [string, string]),
      );

    it("gives every city GeoNames lists the region code it lists today", () => {
      const current = vendored("city-admin1.tsv.gz");
      const wrong = cities
        .filter((c) => {
          const code = current.get(c.id);
          const listed = code?.startsWith(`${c.countryIso2}.`) && !code.endsWith(".");
          return listed && c.subdivisionId !== code!.replace(".", "-");
        })
        .map((c) => `${c.name} ${c.id}: ${c.subdivisionId}`);
      expect(wrong).toEqual([]);
    });

    it("names every region by GeoNames' name for its code, France in French", () => {
      const wrong = [...vendored("admin1CodesASCII.txt.gz")]
        .map(([code, name]) => ({ id: code.replace(".", "-"), name, ours: regions.get(code.replace(".", "-")) }))
        .filter((s) => s.ours !== undefined && !s.id.startsWith("FR-") && s.ours !== s.name)
        .map((s) => `${s.id}: ${s.ours}`);
      expect(wrong).toEqual([]);
      expect(regions.get("FR-53")).toBe("Bretagne");
    });

    it("keeps the most populous first, and the top 10,000 apart", () => {
      expect(file<CityRecord[]>("v1/cities/top.json")).toHaveLength(10_000);
      expect(cities[0]!.population).toBeGreaterThanOrEqual(cities[1]!.population ?? 0);
      expect(cities.find((c) => c.id === "2988507")).toMatchObject({ name: "Paris", subdivisionId: "FR-11" });
    });
  });
});
