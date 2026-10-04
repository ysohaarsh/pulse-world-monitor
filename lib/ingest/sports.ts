import type { Ingester } from "./types";

// TODO(ingest-sports): implement fetchRaw + normalize, add fixture + tests.
export const sportsIngester: Ingester = {
  source: "sports",
  async fetchRaw() {
    return null;
  },
  normalize() {
    return [];
  },
};
