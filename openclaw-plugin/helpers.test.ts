import { describe, expect, it } from "vitest";

import {
  buildShipmentQuery,
  normalizeBaseUrl,
  resolveParcelDeckConfig,
} from "./helpers";

describe("resolveParcelDeckConfig", () => {
  it("prefers plugin config and normalizes the base URL", () => {
    expect(
      resolveParcelDeckConfig({
        baseUrl: "http://localhost:3010/",
        sharedSecret: "secret",
      }),
    ).toMatchObject({
      baseUrl: "http://localhost:3010",
      defaultSource: "openclaw_email",
      sharedSecret: "secret",
      timeoutMs: 15000,
    });
  });

  it("falls back to environment variables", () => {
    expect(
      resolveParcelDeckConfig(undefined, {
        PARCEL_DECK_DEFAULT_SOURCE: "manual",
        PARCEL_DECK_SHARED_SECRET: "env-secret",
        PARCEL_DECK_TIMEOUT_MS: "5000",
        PARCEL_DECK_URL: "http://127.0.0.1:3010",
      }),
    ).toMatchObject({
      baseUrl: "http://127.0.0.1:3010",
      defaultSource: "manual",
      sharedSecret: "env-secret",
      timeoutMs: 5000,
    });
  });
});

describe("plugin helper formatting", () => {
  it("trims trailing slashes from the base URL", () => {
    expect(normalizeBaseUrl("http://localhost:3010///")).toBe("http://localhost:3010");
  });

  it("builds a stable shipment query string", () => {
    expect(
      buildShipmentQuery({
        active: true,
        q: "tracksmith",
        status: "in_transit",
      }),
    ).toBe("?active=true&q=tracksmith&status=in_transit");
  });
});
