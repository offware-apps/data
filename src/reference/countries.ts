/**
 * The countries dataset, from mledoze/countries (ODbL; saved at data/reference/countries.json
 * and kept current by `npm run refresh`) and ISO 3166-1 codes (public facts, by way of
 * i18n-iso-countries, MIT):
 *
 *   countries/names.json           { "RU": "Russia", … }   common English name
 *   countries/article-names.json   the Wikivoyage and Wikipedia article titles: the same names, but for ARTICLE_TITLES
 *   countries/continents.json      { "FR": "Europe", … }
 *   countries/languages.json       { "FR": [{ "code": "fra", "name": "French" }], … }
 *   countries/sovereignty.json     { "US": "un", "HK": "territory", … }
 *
 * Moved from Postcards' scripts/build-languages.mjs and build-sovereignty.mjs.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REFERENCE_DIR, type Built } from "./common";

const require = createRequire(import.meta.url);

export interface SourceCountry {
  cca2: string;
  region: string;
  unMember: boolean;
  name: { common: string };
  languages?: Record<string, string>;
}

// Against the UN's own member list (193 members): mledoze/countries marks the Holy See
// a member, but it is a permanent observer (https://www.un.org/en/about-us/member-states).
const UN_MEMBER_OVERRIDES: Record<string, "un" | "territory"> = { VA: "territory" };

// Where the common name isn't the title of the country's Wikivoyage and Wikipedia article:
// both are titled "Republic of the Congo", and "Congo" alone is ambiguous.
const ARTICLE_TITLES: Record<string, string> = { CG: "Republic of the Congo" };

export function buildCountries(): Built {
  const world = JSON.parse(readFileSync(join(REFERENCE_DIR, "countries.json"), "utf8")) as SourceCountry[];
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

  const articleNames = Object.fromEntries(Object.entries(names).map(([cc, name]) => [cc, ARTICLE_TITLES[cc] ?? name]));

  const byCca2 = new Map(world.map((c) => [c.cca2, c]));
  const sovereignty: Record<string, "un" | "territory"> = {};
  for (const code of Object.keys(iso.getNames("en"))) {
    if (!iso.alpha2ToNumeric(code)) continue;
    sovereignty[code] = UN_MEMBER_OVERRIDES[code] ?? (byCca2.get(code)?.unMember ? "un" : "territory");
  }

  return {
    files: [
      { path: "v1/countries/names.json", body: names },
      { path: "v1/countries/article-names.json", body: articleNames },
      { path: "v1/countries/continents.json", body: continents },
      { path: "v1/countries/languages.json", body: languages },
      { path: "v1/countries/sovereignty.json", body: sovereignty },
    ],
    records: { countries: Object.keys(names).length },
  };
}
