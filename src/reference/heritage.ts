/**
 * The heritage dataset: the UNESCO World Heritage List (CC BY-SA 3.0 IGO, © UNESCO World
 * Heritage Centre), complete through the 47th session (July 2025). The source payload is
 * vendored at data/reference/whc-sites-2025.json.gz, retrieved 2026-07-11 from a public
 * mirror of whc.unesco.org's syndication data, so the build needs no network.
 *
 *   heritage/unesco.json   { id, name, countryIso2, lat, lon, category }
 *
 * A site in several countries is listed once per country, its id suffixed with the country
 * code. A site the source has no coordinates for keeps lat 0 / lon 0, read as "no
 * coordinates", never guessed. The one site without a country code (Old City of Jerusalem)
 * is left out rather than given one. Names are made plain text.
 *
 * Moved from Postcards' scripts/build-heritage-full.mjs; the output is the same.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { REFERENCE_DIR, type Built } from "./common";

interface SourceSite {
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

export function buildHeritage(): Built {
  const sites = JSON.parse(gunzipSync(readFileSync(join(REFERENCE_DIR, "whc-sites-2025.json.gz"))).toString("utf8")) as SourceSite[];
  if (!Array.isArray(sites) || sites.length < 1100) throw new Error("heritage: unexpected source");

  const out: (HeritageSite & { idNo?: string })[] = [];
  const sitesKept = new Set<string>();
  for (const s of sites) {
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
    if (isos.length === 0) continue;
    sitesKept.add(String(s.id_no));
    const c = s.coordinates;
    const has = typeof c?.lat === "number" && typeof c?.lon === "number" && Number.isFinite(c.lat) && Number.isFinite(c.lon);
    const lat = has ? Number(c!.lat!.toFixed(4)) : 0;
    const lon = has ? Number(c!.lon!.toFixed(4)) : 0;
    const slug = slugify(name);
    for (const iso of isos) {
      out.push({
        id: isos.length > 1 ? `whs-${slug}-${iso.toLowerCase()}` : `whs-${slug}`,
        name,
        countryIso2: iso,
        lat,
        lon,
        category,
        idNo: String(s.id_no),
      });
    }
  }

  // Two sites can share a slug: the source's own id tells them apart.
  const counts = new Map<string, number>();
  for (const e of out) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
  for (const e of out) {
    if ((counts.get(e.id) ?? 0) > 1) e.id = `${e.id}-${e.idNo}`;
    delete e.idNo;
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const ids = new Set<string>();
  for (const e of out) {
    if (ids.has(e.id)) throw new Error(`heritage: duplicate id ${e.id}`);
    ids.add(e.id);
    if (!/^whs-[a-z0-9-]+$/.test(e.id) || /[<>]/.test(e.name) || Math.abs(e.lat) > 90 || Math.abs(e.lon) > 180) {
      throw new Error(`heritage: bad entry ${e.id}`);
    }
  }
  return { files: [{ path: "v1/heritage/unesco.json", body: out }], records: { heritage: sitesKept.size } };
}
