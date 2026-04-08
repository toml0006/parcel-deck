import { ShipmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildEasyPostTrackingUpdate, getEasyPostCarrierCode } from "@/lib/shipments/easypost";

describe("EasyPost helpers", () => {
  it("maps normalized carriers to EasyPost carrier codes", () => {
    expect(getEasyPostCarrierCode("ups")).toBe("UPS");
    expect(getEasyPostCarrierCode("fedex")).toBe("FedEx");
    expect(getEasyPostCarrierCode("dhl")).toBe("DHLExpress");
  });

  it("normalizes tracker payloads into shipment updates and events", () => {
    const result = buildEasyPostTrackingUpdate({
      carrier: "UPS",
      est_delivery_date: "2026-04-11T18:00:00.000Z",
      id: "trk_123",
      public_url: "https://track.easypost.com/example",
      status: "out_for_delivery",
      tracking_code: "EZ3000000003",
      tracking_details: [
        {
          datetime: "2026-04-11T13:00:00.000Z",
          message: "Out for delivery",
          source: "UPS",
          status: "out_for_delivery",
          tracking_location: {
            city: "Austin",
            state: "TX",
            zip: "78701",
          },
        },
        {
          datetime: "2026-04-10T18:00:00.000Z",
          message: "Departed facility",
          source: "UPS",
          status: "in_transit",
          tracking_location: {
            city: "Dallas",
            state: "TX",
            zip: "75201",
          },
        },
      ],
      updated_at: "2026-04-11T13:01:00.000Z",
    });

    expect(result.currentStatus).toBe(ShipmentStatus.out_for_delivery);
    expect(result.providerTrackingId).toBe("trk_123");
    expect(result.trackingUrl).toBe("https://track.easypost.com/example");
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      description: "Out for delivery",
      location: "Austin, TX, 78701",
      status: ShipmentStatus.out_for_delivery,
    });
  });

  it("maps failure and return statuses into app statuses", () => {
    expect(
      buildEasyPostTrackingUpdate({
        id: "trk_failure",
        status: "failure",
        tracking_code: "EZ6000000006",
      }).currentStatus,
    ).toBe(ShipmentStatus.exception);

    expect(
      buildEasyPostTrackingUpdate({
        id: "trk_returned",
        status: "return_to_sender",
        tracking_code: "EZ5000000005",
      }).currentStatus,
    ).toBe(ShipmentStatus.returned);
  });
});
