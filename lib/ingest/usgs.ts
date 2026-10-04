import type { Ingester } from "./types";

// TODO(ingest-usgs): implement fetchRaw + normalize, add fixture + tests.
export const usgsIngester: Ingester = {
  source: "usgs",
  async fetchRaw() {
    return null;
  },
  normalize() {
    return [];
  },
};
