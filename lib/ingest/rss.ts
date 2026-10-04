import type { Ingester } from "./types";

// TODO(ingest-rss): implement fetchRaw + normalize, add fixture + tests.
export const rssIngester: Ingester = {
  source: "rss",
  async fetchRaw() {
    return null;
  },
  normalize() {
    return [];
  },
};
