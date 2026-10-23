/**
 * The moments dataset: Postcards' list of travel experiences ("Moments"). Each moment's
 * name, hint and emoji were written for it (CC0); its anchor coordinates and the experience
 * itself come from the sources each item cites (Wikidata, GeoNames, UNESCO's World
 * Heritage and Intangible Cultural Heritage lists, Wikivoyage). Kept as written in
 * data/reference/moments.json.
 *
 *   moments/moments.json
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REFERENCE_DIR, type Built } from "./common";

export function buildMoments(): Built {
  const body = JSON.parse(readFileSync(join(REFERENCE_DIR, "moments.json"), "utf-8")) as { experiences?: unknown[] };
  if (!Array.isArray(body.experiences)) throw new Error("moments: no experiences");
  return { files: [{ path: "v1/moments/moments.json", body }], records: { moments: body.experiences.length } };
}
