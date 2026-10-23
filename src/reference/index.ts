/**
 * Every dataset built from a source other than Wikidata's query service: cities, regions,
 * airports, UNESCO sites, European stations, countries and moments. They need no Wikidata
 * fetch; European stations are read from GitHub, and when that fails they're left out of
 * this build rather than failing it.
 */
import { buildAirports } from "./airports";
import { buildCities } from "./cities";
import type { Built } from "./common";
import { buildCountries } from "./countries";
import { buildHeritage } from "./heritage";
import { buildMoments } from "./moments";
import { buildTrainline } from "./trainline";

export async function buildReference(retrieved: string, options: { network?: boolean } = {}): Promise<Built> {
  const parts = [buildCities(), buildAirports(), buildHeritage(), buildCountries(), buildMoments()];
  if (options.network !== false) {
    try {
      parts.push(await buildTrainline(retrieved));
    } catch (err) {
      console.error(`[reference] European stations left out of this build (${String(err)})`);
    }
  }
  return {
    files: parts.flatMap((p) => p.files),
    records: Object.assign({}, ...parts.map((p) => p.records)) as Record<string, number>,
  };
}
