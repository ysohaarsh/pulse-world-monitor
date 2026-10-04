import type { Ingester } from "./types";

// TODO(ingest-gdelt): implement fetchRaw + normalize, add fixture + tests.
export const gdeltIngester: Ingester = {
  source: "gdelt",
  async fetchRaw() {
    return null;
  },
  normalize() {
    return [];
  },
};
