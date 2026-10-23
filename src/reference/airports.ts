/**
 * The airports dataset: IATA-coded airports from OpenFlights (ODbL, aggregated from the
 * public-domain OurAirports), by way of the airport-data package.
 *
 *   airports/airports.json
 *
 * Moved from Postcards' scripts/build-reference.mjs; the output is the same.
 */
import { createRequire } from "node:module";
import type { Built } from "./common";

const require = createRequire(import.meta.url);

interface SourceAirport {
  iata?: string;
  name: string;
  city?: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface Airport {
  id: string;
  name: string;
  city: string;
  countryIso2: string;
  lat: number;
  lon: number;
}

// A few OpenFlights country names differ from ISO 3166 English names. "Netherlands
// Antilles" is left out on purpose: it split in 2010 into CW, SX and BQ and the source
// can't say which, so those airports are dropped rather than guessed.
const COUNTRY_OVERRIDES: Record<string, string> = {
  "Congo (Kinshasa)": "CD", "Congo (Brazzaville)": "CG", Burma: "MM", Laos: "LA",
  Syria: "SY", Micronesia: "FM", "Virgin Islands": "VI", "British Virgin Islands": "VG",
  "Falkland Islands": "FK", Moldova: "MD", Macedonia: "MK", Swaziland: "SZ", Macau: "MO",
  Brunei: "BN", "East Timor": "TL", "Midway Islands": "UM", "Johnston Atoll": "UM",
  "Wake Island": "UM",
};

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function buildAirports(): Built {
  const source = require("airport-data") as SourceAirport[];
  const countries = require("i18n-iso-countries") as {
    registerLocale(locale: unknown): void;
    getAlpha2Code(name: string, lang: string): string | undefined;
  };
  countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

  const airports: Airport[] = [];
  const seen = new Set<string>();
  for (const a of source) {
    const iata = a.iata;
    if (!iata || !/^[A-Z]{3}$/.test(iata) || seen.has(iata)) continue;
    if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) continue;
    const cc = COUNTRY_OVERRIDES[a.country] ?? countries.getAlpha2Code(a.country, "en");
    if (!cc) continue;
    seen.add(iata);
    airports.push({
      id: iata,
      name: a.name,
      city: a.city && a.city !== a.name ? a.city : "",
      countryIso2: cc,
      lat: round4(a.latitude),
      lon: round4(a.longitude),
    });
  }
  airports.sort((a, b) => a.id.localeCompare(b.id));
  return { files: [{ path: "v1/airports/airports.json", body: airports }], records: { airports: airports.length } };
}
