import type { Ingester } from "./types";

// TODO(ingest-gdacs): implement fetchRaw + normalize, add fixture + tests.
export const gdacsIngester: Ingester = {
  source: "gdacs",
  async fetchRaw() {
    return null;
  },
  normalize() {
    return [];
  },
};
