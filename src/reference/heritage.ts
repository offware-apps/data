/**
 * The heritage dataset: the UNESCO World Heritage List (CC BY-SA 3.0 IGO, © UNESCO World
 * Heritage Centre). The source fields the build reads are saved at
 * data/reference/whc-sites.json.gz and kept current by `npm run refresh`; the first copy,
 * complete through the 47th session (July 2025), was retrieved 2026-07-11 from a public
 * mirror of whc.unesco.org's syndication data.
 *
 *   heritage/unesco.json   { id, name, countryIso2, lat, lon, category }
 *
 * A site in several countries is listed once per country, its id suffixed with the country
 * code. Ids are kept in data/reference/heritage-ids.json by UNESCO's own site number, so a
 * site UNESCO renames keeps its id and visits saved against it still match. A site the
 * source has no coordinates for keeps lat 0 / lon 0, read as "no coordinates", never
 * guessed. The one site without a country code (Old City of Jerusalem) is left out rather
 * than given one. Names are made plain text.
 *
 * Moved from Postcards' scripts/build-heritage-full.mjs.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { REFERENCE_DIR, type Built } from "./common";

export interface SourceSite {
  id_no: number | string;
  name_en: string;
  category: string;
  iso_codes?: string;
  coordinates?: { lat?: number; lon?: number };
}

export interface HeritageSite {
  id: string;
  name: string;
  countryIso2: string;
  lat: number;
  lon: number;
  category: "cultural" | "natural" | "mixed";
}

const ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", eacute: "é", egrave: "è",
};

/** Strips the HTML tags and entities the UNESCO feed sometimes embeds (<em>). */
export function plainName(raw: string): string {
  return String(raw)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(quot|apos|nbsp|ndash|mdash|rsquo|lsquo|eacute|egrave);/g, (_, e: string) => ENTITIES[e] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/[ßẞ]/g, "ss")
    .replace(/[đĐðÐ]/g, "d")
    .replace(/[þÞ]/g, "th")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CATEGORY: Record<string, HeritageSite["category"]> = { Cultural: "cultural", Natural: "natural", Mixed: "mixed" };

/** A site's entries: one per country, keyed "<id_no>-<country>". */
function entries(s: SourceSite): { key: string; candidate: string; site: Omit<HeritageSite, "id"> }[] {
  const name = plainName(s.name_en);
  const category = CATEGORY[s.category];
  if (!name || !category) throw new Error(`heritage: site ${s.id_no} has a bad name or category`);
  const isos = [
    ...new Set(
      String(s.iso_codes ?? "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z]{2}$/.test(c)),
    ),
  ];
  const c = s.coordinates;
  const has = typeof c?.lat === "number" && typeof c?.lon === "number" && Number.isFinite(c.lat) && Number.isFinite(c.lon);
  const lat = has ? Number(c!.lat!.toFixed(4)) : 0;
  const lon = has ? Number(c!.lon!.toFixed(4)) : 0;
  const slug = slugify(name);
  return isos.map((iso) => ({
    key: `${s.id_no}-${iso}`,
    candidate: isos.length > 1 ? `whs-${slug}-${iso.toLowerCase()}` : `whs-${slug}`,
    site: { name, countryIso2: iso, lat, lon, category },
  }));
}

/**
 * Every entry's id: the one it already has, or a new one from its name. A new id that
 * another site has or had, or that two new entries would share, takes the site's number.
 * Ids are never reused: the result keeps those of sites no longer listed.
 */
export function heritageIds(sites: SourceSite[], known: Record<string, string>): Record<string, string> {
  const taken = new Set(Object.values(known));
  const fresh = sites.flatMap((s) => entries(s).map((e) => ({ ...e, idNo: String(s.id_no) }))).filter((e) => !known[e.key]);
  const counts = new Map<string, number>();
  for (const e of fresh) counts.set(e.candidate, (counts.get(e.candidate) ?? 0) + 1);
  const ids = { ...known };
  for (const e of fresh) {
    ids[e.key] = taken.has(e.candidate) || (counts.get(e.candidate) ?? 0) > 1 ? `${e.candidate}-${e.idNo}` : e.candidate;
  }
  return Object.fromEntries(Object.entries(ids).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
}

export function buildHeritage(): Built {
  const sites = JSON.parse(gunzipSync(readFileSync(join(REFERENCE_DIR, "whc-sites.json.gz"))).toString("utf8")) as SourceSite[];
  if (!Array.isArray(sites) || sites.length < 1100) throw new Error("heritage: unexpected source");
  const ids = heritageIds(sites, JSON.parse(readFileSync(join(REFERENCE_DIR, "heritage-ids.json"), "utf8")) as Record<string, string>);

  const out: HeritageSite[] = [];
  const sitesKept = new Set<string>();
  for (const s of sites) {
    for (const e of entries(s)) {
      sitesKept.add(String(s.id_no));
      out.push({ id: ids[e.key]!, ...e.site });
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const seen = new Set<string>();
  for (const e of out) {
    if (seen.has(e.id)) throw new Error(`heritage: duplicate id ${e.id}`);
    seen.add(e.id);
    if (!/^whs-[a-z0-9-]+$/.test(e.id) || /[<>]/.test(e.name) || Math.abs(e.lat) > 90 || Math.abs(e.lon) > 180) {
      throw new Error(`heritage: bad entry ${e.id}`);
    }
  }
  return { files: [{ path: "v1/heritage/unesco.json", body: out }], records: { heritage: sitesKept.size } };
}
