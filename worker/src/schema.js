import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

let cached;
export function loadSchema() {
  if (cached) return cached;
  cached = readFileSync(join(here, "..", "schema.sql"), "utf8");
  return cached;
}
