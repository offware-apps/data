/**
 * The sources `npm run refresh` keeps current, and how each download becomes the saved copy
 * in data/reference/ that the builders read. Only the fields the builders use are kept.
 * Every function here throws on anything unexpected, so a bad download keeps the old copy.
 */
import type { SourceCountry } from "./countries";
import { heritageIds, type SourceSite } from "./heritage";

const UA = "offware-data-refresh (+https://github.com/offware-apps/data)";

export const GEONAMES = "https://download.geonames.org/export/dump/";
export const COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
export const UNESCO_META_URL = "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001";
export const UNESCO_EXPORT_URL = `${UNESCO_META_URL}/exports/json?select=id_no,name_en,iso_codes,category,coordinates`;

/** What was last seen of one remote file. */
export interface Seen {
  url: string;
  etag?: string;
  lastModified?: string;
  /** SHA-256 of the body. */
  sha256?: string;
  /** UNESCO's own "modified" date for its dataset. */
  modified?: string;
}

/** A refresh may lose at most 5% of a source's records; anything worse is a bad download. */
export function enough(next: number, saved: number): boolean {
  return next >= saved * 0.95;
}

/**
 * One conditional GET: "not modified" when the server says so (ETag or date) or when the body
 * hashes the same as last time. Never retried: a failure waits for next week.
 */
export async function get(url: string, seen: Seen | undefined, timeoutMs = 120_000): Promise<{ body: Buffer; seen: Seen } | null> {
  const { createHash } = await import("node:crypto");
  const headers: Record<string, string> = { "user-agent": UA };
  if (seen?.url === url && seen.etag) headers["if-none-match"] = seen.etag;
  if (seen?.url === url && seen.lastModified) headers["if-modified-since"] = seen.lastModified;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 304) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");
  if (seen?.url === url && seen.sha256 === sha256) return null;
  const next: Seen = { url, sha256 };
  const etag = res.headers.get("etag");
  const lastModified = res.headers.get("last-modified");
  if (etag) next.etag = etag;
  if (lastModified) next.lastModified = lastModified;
  return { body, seen: next };
}

/**
 * cities.tsv from GeoNames' cities1000.txt. Cities already saved keep their place in the
 * file; new ones follow by id. A saved city GeoNames no longer lists is kept as it was, so
 * its id still resolves.
 */
export function citiesTsv(cities1000: string, saved: string[][]): string[][] {
  const fresh = new Map<string, string[]>();
  for (const line of cities1000.split("\n")) {
    const f = line.split("\t");
    if (f.length < 15 || !/^\d+$/.test(f[0]!) || !/^[A-Z]{2}$/.test(f[8]!)) continue;
    const lat = Number(f[4]);
    const lon = Number(f[5]);
    if (!f[1] || !f[4] || !f[5] || !Number.isFinite(lat) || !Number.isFinite(lon) || /[\t\r]/.test(f[1])) continue;
    fresh.set(f[0]!, [f[0]!, f[1], f[8]!, f[10] ?? "", "", Number(f[14]) > 0 ? String(Number(f[14])) : "", f[4], f[5]]);
  }
  if (!enough(fresh.size, saved.length)) throw new Error(`cities: ${fresh.size} cities, ${saved.length} saved`);
  const rows = saved.map((row) => fresh.get(row[0]!) ?? row);
  const savedIds = new Set(saved.map((row) => row[0]));
  const added = [...fresh.values()].filter((row) => !savedIds.has(row[0])).sort((a, b) => Number(a[0]) - Number(b[0]));
  return [...rows, ...added];
}

/** admin1CodesASCII.txt: "CC.code\tname\tasciiname\tgeonameid" lines. */
export function admin1Codes(text: string, savedLines: number): string {
  const lines = text.split("\n").filter(Boolean);
  if (!lines.every((l) => /^[A-Z]{2}\.[^\t]+\t[^\t]+\t/.test(l)) || !enough(lines.length, savedLines)) {
    throw new Error(`admin-1 codes: unexpected file (${lines.length} lines)`);
  }
  return lines.join("\n") + "\n";
}

/** countries.json from mledoze/countries. */
export function countriesJson(text: string, saved: number): SourceCountry[] {
  const world = JSON.parse(text) as SourceCountry[];
  if (!Array.isArray(world) || !enough(world.length, saved)) throw new Error("countries: unexpected file");
  return world.map((c) => {
    if (!/^[A-Z]{2}$/.test(c.cca2) || typeof c.name?.common !== "string" || typeof c.region !== "string" || typeof c.unMember !== "boolean") {
      throw new Error(`countries: bad entry ${JSON.stringify(c).slice(0, 80)}`);
    }
    return { cca2: c.cca2, region: c.region, unMember: c.unMember, name: { common: c.name.common }, ...(c.languages ? { languages: c.languages } : {}) };
  });
}

/** The UNESCO list, and every site's id: those it had, and new ones for new sites. */
export function unescoSites(text: string, saved: number, ids: Record<string, string>): { sites: SourceSite[]; ids: Record<string, string> } {
  const list = JSON.parse(text) as SourceSite[];
  if (!Array.isArray(list) || !enough(list.length, saved)) throw new Error("heritage: unexpected file");
  const sites = list
    .map((s) => ({ id_no: String(s.id_no), name_en: s.name_en, iso_codes: s.iso_codes, category: s.category, coordinates: s.coordinates }))
    .sort((a, b) => Number(a.id_no) - Number(b.id_no));
  if (sites.some((s) => !/^\d+$/.test(s.id_no))) throw new Error("heritage: a site without a number");
  return { sites, ids: heritageIds(sites, ids) };
}
