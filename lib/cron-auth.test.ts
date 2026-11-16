import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isCronAuthorized } from "./cron-auth";

const SECRET = "s".repeat(32);

function req(authorization?: string): Request {
  return new Request("https://example.com/api/ingest", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("isCronAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the matching bearer token", () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect(isCronAuthorized(req(`Bearer ${SECRET}`))).toBe(true);
  });

  it("rejects a wrong token, missing header and wrong scheme", () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect(isCronAuthorized(req(`Bearer ${"x".repeat(32)}`))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
    expect(isCronAuthorized(req(SECRET))).toBe(false);
    expect(isCronAuthorized(req(`Basic ${SECRET}`))).toBe(false);
  });

  it("fails closed when the secret is unset, empty or too short", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorized(req("Bearer "))).toBe(false);
    vi.stubEnv("CRON_SECRET", "short");
    expect(isCronAuthorized(req("Bearer short"))).toBe(false);
    vi.unstubAllEnvs();
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(req("Bearer undefined"))).toBe(false);
  });
});
