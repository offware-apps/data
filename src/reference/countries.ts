/**
 * The countries dataset, from world-countries (ODbL) and ISO 3166-1 codes (public facts,
 * by way of i18n-iso-countries, MIT):
 *
 *   countries/names.json           { "RU": "Russia", … }   common English name
 *   countries/article-names.json   the same names: the Wikivoyage and Wikipedia article titles
 *   countries/continents.json      { "FR": "Europe", … }
 *   countries/languages.json       { "FR": [{ "code": "fra", "name": "French" }], … }
 *   countries/sovereignty.json     { "US": "un", "HK": "territory", … }
 *
 * Moved from Postcards' scripts/build-languages.mjs and build-sovereignty.mjs; the output is
 * the same.
 */
import { createRequire } from "node:module";
import type { Built } from "./common";

const require = createRequire(import.meta.url);

interface SourceCountry {
  cca2: string;
  region: string;
  unMember: boolean;
  name: { common: string };
  languages?: Record<string, string>;
}

// Against the UN's own member list (193 members): world-countries 5.1.0 marks the Holy See
// a member, but it is a permanent observer (https://www.un.org/en/about-us/member-states).
const UN_MEMBER_OVERRIDES: Record<string, "un" | "territory"> = { VA: "territory" };

export function buildCountries(): Built {
  const world = require("world-countries") as SourceCountry[];
  const iso = require("i18n-iso-countries") as {
    registerLocale(locale: unknown): void;
    getNames(lang: string): Record<string, string>;
    alpha2ToNumeric(code: string): string | undefined;
  };
  iso.registerLocale(require("i18n-iso-countries/langs/en.json"));

  const names: Record<string, string> = {};
  const languages: Record<string, { code: string; name: string }[]> = {};
  const continents: Record<string, string> = {};
  for (const c of world) {
    if (!c.cca2) continue;
    if (c.name?.common) names[c.cca2] = c.name.common;
    const langs = Object.entries(c.languages ?? {}).map(([code, name]) => ({ code, name }));
    if (langs.length) languages[c.cca2] = langs;
  }
  for (const c of [...world].sort((a, b) => a.cca2.localeCompare(b.cca2))) continents[c.cca2] = c.region;

  const byCca2 = new Map(world.map((c) => [c.cca2, c]));
  const sovereignty: Record<string, "un" | "territory"> = {};
  for (const code of Object.keys(iso.getNames("en"))) {
    if (!iso.alpha2ToNumeric(code)) continue;
    sovereignty[code] = UN_MEMBER_OVERRIDES[code] ?? (byCca2.get(code)?.unMember ? "un" : "territory");
  }

  return {
    files: [
      { path: "v1/countries/names.json", body: names },
      { path: "v1/countries/article-names.json", body: names },
      { path: "v1/countries/continents.json", body: continents },
      { path: "v1/countries/languages.json", body: languages },
      { path: "v1/countries/sovereignty.json", body: sovereignty },
    ],
    records: { countries: Object.keys(names).length },
  };
}
