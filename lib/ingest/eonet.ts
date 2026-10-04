import type { Ingester } from "./types";

// TODO(ingest-eonet): implement fetchRaw + normalize, add fixture + tests.
export const eonetIngester: Ingester = {
  source: "eonet",
  async fetchRaw() {
    return null;
  },
  normalize() {
    return [];
  },
};
