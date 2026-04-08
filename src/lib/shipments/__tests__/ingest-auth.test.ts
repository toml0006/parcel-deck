import { afterEach, describe, expect, it } from "vitest";

import { env } from "@/lib/env";
import { authorizeIngestRequest } from "@/lib/shipments/ingest";

const originalSecret = env.ingestSharedSecret;

describe("authorizeIngestRequest", () => {
  afterEach(() => {
    env.ingestSharedSecret = originalSecret;
  });

  it("accepts bearer tokens and header tokens that match the shared secret", () => {
    env.ingestSharedSecret = "test-secret";

    expect(
      authorizeIngestRequest(
        new Request("http://localhost", {
          headers: {
            authorization: "Bearer test-secret",
          },
        }),
      ),
    ).toBe(true);

    expect(
      authorizeIngestRequest(
        new Request("http://localhost", {
          headers: {
            "x-ingest-token": "test-secret",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects missing or incorrect secrets", () => {
    env.ingestSharedSecret = "test-secret";

    expect(authorizeIngestRequest(new Request("http://localhost"))).toBe(false);
    expect(
      authorizeIngestRequest(
        new Request("http://localhost", {
          headers: {
            authorization: "Bearer wrong-secret",
          },
        }),
      ),
    ).toBe(false);
  });
});
