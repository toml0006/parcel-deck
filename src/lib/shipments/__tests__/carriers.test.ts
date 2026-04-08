import { describe, expect, it } from "vitest";

import {
  buildTrackingUrl,
  getCarrierLabel,
  normalizeCarrierHint,
  normalizeTrackingNumber,
} from "@/lib/shipments/carriers";
import { parseIngestShipmentInput } from "@/lib/shipments/ingest";

describe("carrier helpers", () => {
  it("normalizes carrier hints and tracking numbers", () => {
    expect(normalizeCarrierHint("FedEx Home Delivery")).toBe("fedex");
    expect(normalizeCarrierHint("US Postal Service")).toBe("usps");
    expect(normalizeTrackingNumber("1z 999-aa1 01 2345 6784")).toBe("1Z999AA10123456784");
  });

  it("builds carrier tracking URLs for supported carriers", () => {
    expect(buildTrackingUrl("UPS", "1z999aa10123456784")).toBe(
      "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    );
    expect(buildTrackingUrl("USPS", "9400 1110")).toBe(
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=94001110",
    );
    expect(buildTrackingUrl("Unknown", "123")).toBeNull();
  });

  it("formats human-friendly carrier labels", () => {
    expect(getCarrierLabel("amazon_logistics")).toBe("Amazon Logistics");
    expect(getCarrierLabel("local_courier")).toBe("Local Courier");
    expect(getCarrierLabel()).toBe("Unknown carrier");
  });
});

describe("parseIngestShipmentInput", () => {
  it("accepts minimal payloads with one identifier", () => {
    expect(
      parseIngestShipmentInput({
        order_number: "ORDER-1",
      }),
    ).toMatchObject({
      order_number: "ORDER-1",
      source: "openclaw_email",
    });
  });

  it("rejects payloads without any usable identifiers", () => {
    expect(() => parseIngestShipmentInput({ merchant: "Tracksmith" })).toThrow(
      /Provide at least one identifier/i,
    );
  });
});
