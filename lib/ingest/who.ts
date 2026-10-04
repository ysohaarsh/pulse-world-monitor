import type { Ingester } from "./types";

// TODO(ingest-who): implement fetchRaw + normalize, add fixture + tests.
export const whoIngester: Ingester = {
  source: "who",
  async fetchRaw() {
    return null;
  },
  normalize() {
    return [];
  },
};
