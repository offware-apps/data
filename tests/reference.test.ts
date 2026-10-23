import { describe, expect, it } from "vitest";
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
});
