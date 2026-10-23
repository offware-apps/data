import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REFERENCE_DIR } from "../src/reference/common";
import type { SourceSite } from "../src/reference/heritage";
import { admin1Codes, citiesTsv, countriesJson, enough, unescoSites } from "../src/reference/refresh";

const savedCities = gunzipSync(readFileSync(join(REFERENCE_DIR, "cities.tsv.gz")))
  .toString("utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"));

/** A cities1000.txt line, as GeoNames writes it. */
const geonames = (id: string, name: string, cc: string, admin1: string, population: string, lat = "1.5", lon = "2.5") =>
  [id, name, name, "", lat, lon, "P", "PPL", cc, "", admin1, "", "", "", population, "", "10", "Europe/Paris", "2026-10-01"].join("\t");

describe("source refresh", () => {
  it("leaves the saved cities as they are when GeoNames lists the same", () => {
    const text = savedCities
      .filter((r) => r[4] !== "u")
      .map(([id = "", name = "", cc = "", admin1 = "", , population = "", lat = "", lon = ""]) => geonames(id, name, cc, admin1, population || "0", lat, lon))
      .join("\n");
    expect(citiesTsv(text, savedCities)).toEqual(savedCities);
  });

  it("updates a city in place, adds new ones after, and keeps one GeoNames dropped", () => {
    const saved = [
      ["2", "Old", "FR", "11", "", "", "1", "1"],
      ["1", "Gone", "FR", "", "u", "", "1", "1"],
    ];
    const rows = citiesTsv([geonames("2", "Renamed", "FR", "44", "1200"), geonames("5", "New", "DE", "02", "0"), geonames("3", "Newer", "DE", "02", "5000")].join("\n"), saved);
    expect(rows).toEqual([
      ["2", "Renamed", "FR", "44", "", "1200", "1.5", "2.5"],
      ["1", "Gone", "FR", "", "u", "", "1", "1"],
      ["3", "Newer", "DE", "02", "", "5000", "1.5", "2.5"],
      ["5", "New", "DE", "02", "", "", "1.5", "2.5"],
    ]);
  });

  it("keeps the saved copy when a download loses more than 5%", () => {
    expect(enough(95, 100)).toBe(true);
    expect(enough(94, 100)).toBe(false);
    expect(() => citiesTsv(geonames("1", "Only", "FR", "11", "1"), savedCities)).toThrow();
    expect(() => admin1Codes("<html>maintenance</html>", 10)).toThrow();
    expect(() => countriesJson("[]", 250)).toThrow();
    expect(() => countriesJson('[{"cca2":"fr"}]', 1)).toThrow();
  });

  it("keeps the fields the countries build reads", () => {
    const world = [{ cca2: "FR", region: "Europe", unMember: true, name: { common: "France", official: "French Republic" }, languages: { fra: "French" }, capital: ["Paris"] }];
    expect(countriesJson(JSON.stringify(world), 1)).toEqual([{ cca2: "FR", region: "Europe", unMember: true, name: { common: "France" }, languages: { fra: "French" } }]);
  });

  it("keeps a UNESCO site's id when it is renamed, and never gives a new site an old id", () => {
    const site = (id_no: string, name_en: string, iso_codes = "fr"): SourceSite => ({ id_no, name_en, iso_codes, category: "Cultural", coordinates: { lat: 1, lon: 2 } });
    const known = { "1-FR": "whs-old-town", "9-FR": "whs-harbour" };
    const { sites, ids } = unescoSites(JSON.stringify([site("7", "Harbour"), site("1", "Old Town and its Walls")]), 2, known);
    expect(sites.map((s) => s.id_no)).toEqual(["1", "7"]);
    expect(ids).toEqual({ "1-FR": "whs-old-town", "7-FR": "whs-harbour-7", "9-FR": "whs-harbour" });
  });
});
