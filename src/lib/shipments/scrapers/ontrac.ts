import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  USER_AGENT,
  failure,
} from "./types";

export const ontracScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const res = await fetch(
      `https://www.ontrac.com/trackingres.asp?tracking_number=${encodeURIComponent(trackingNumber)}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!res.ok) return failure(`OnTrac HTTP ${res.status}`, res.status >= 500);
    const text = await res.text();
    const statusText =
      text.match(/Status[:\s]+<[^>]*>([^<]+)</i)?.[1] ??
      text.match(/"status"\s*:\s*"([^"]+)"/i)?.[1] ??
      "";
    const status = normalizeShipmentStatus(statusText);
    return {
      ok: true,
      carrier: "ontrac",
      status,
      estimatedDelivery: null,
      deliveredAt: status === ShipmentStatus.delivered ? new Date() : null,
      events: [],
    };
  } catch (error) {
    return failure(`OnTrac scrape error: ${(error as Error).message}`, true);
  }
};

export const lasershipScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const res = await fetch(
      `https://www.lasership.com/track/${encodeURIComponent(trackingNumber)}/detail`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!res.ok) return failure(`LaserShip HTTP ${res.status}`, res.status >= 500);
    const text = await res.text();
    const statusText =
      text.match(/"status"\s*:\s*"([^"]+)"/i)?.[1] ??
      text.match(/class="shipment-status"[^>]*>([^<]+)</i)?.[1] ??
      "";
    const status = normalizeShipmentStatus(statusText);
    return {
      ok: true,
      carrier: "lasership",
      status,
      estimatedDelivery: null,
      deliveredAt: status === ShipmentStatus.delivered ? new Date() : null,
      events: [],
    };
  } catch (error) {
    return failure(`LaserShip scrape error: ${(error as Error).message}`, true);
  }
};
