import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Vendored source files: data/reference/. */
export const REFERENCE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "reference");

/** Files under public/, and the record count of each dataset they belong to. */
export interface Built {
  files: { path: string; body: unknown }[];
  records: Record<string, number>;
}
