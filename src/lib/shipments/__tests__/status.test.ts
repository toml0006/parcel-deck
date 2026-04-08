import { ShipmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getShipmentStatusMeta,
  getShipmentStatusRank,
  isActiveShipmentStatus,
  normalizeShipmentStatus,
} from "@/lib/shipments/status";

describe("normalizeShipmentStatus", () => {
  it("maps known aliases to canonical statuses", () => {
    expect(normalizeShipmentStatus("Out for Delivery")).toBe(
      ShipmentStatus.out_for_delivery,
    );
    expect(normalizeShipmentStatus("pre-transit")).toBe(ShipmentStatus.label_created);
    expect(normalizeShipmentStatus("failed delivery")).toBe(ShipmentStatus.exception);
    expect(normalizeShipmentStatus("")).toBe(ShipmentStatus.unknown);
  });

  it("passes through canonical enum values", () => {
    expect(normalizeShipmentStatus(ShipmentStatus.in_transit)).toBe(
      ShipmentStatus.in_transit,
    );
  });
});

describe("shipment status helpers", () => {
  it("marks delivered and returned shipments as inactive", () => {
    expect(isActiveShipmentStatus(ShipmentStatus.delivered)).toBe(false);
    expect(isActiveShipmentStatus(ShipmentStatus.returned)).toBe(false);
    expect(isActiveShipmentStatus(ShipmentStatus.in_transit)).toBe(true);
  });

  it("provides stable metadata and rank for display", () => {
    expect(getShipmentStatusMeta(ShipmentStatus.exception)).toMatchObject({
      eyebrow: "Needs attention",
      label: "Exception",
    });
    expect(getShipmentStatusRank(ShipmentStatus.out_for_delivery)).toBeLessThan(
      getShipmentStatusRank(ShipmentStatus.delivered),
    );
  });
});
