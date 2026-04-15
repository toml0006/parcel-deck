import { ShipmentStatus } from "@prisma/client";

import { detectCarrierFromTrackingNumber, normalizeCarrierHint } from "../carriers";
import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  isAllowedUrl,
  stableDedupeKey,
} from "./types";

const SWEETWATER_HOSTS = ["sweetwater.com"];

export const sweetwaterScraper: CarrierScraper = async ({ trackingUrl }) => {
  // The Sweetwater tracking URL is stored at ingest time; we don't try to
  // reconstruct it because the merchant-internal prefix isn't stable.
  if (!trackingUrl) return failure("Sweetwater: no tracking URL", false);
  if (!isAllowedUrl(trackingUrl, SWEETWATER_HOSTS)) {
    return failure("Sweetwater: URL host not allowed", false);
  }
  const url = trackingUrl;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return failure(`Sweetwater HTTP ${res.status}`, res.status >= 500);
    const html = await res.text();

    const nativeTrackingMatch =
      html.match(/data-carrier-tracking(?:-number)?="([^"]+)"/)?.[1] ??
      html.match(/"carrierTrackingNumber"\s*:\s*"([^"]+)"/)?.[1] ??
      null;
    const nativeCarrierMatch =
      html.match(/"carrierName"\s*:\s*"([^"]+)"/)?.[1] ??
      html.match(/data-carrier-name="([^"]+)"/)?.[1] ??
      null;

    const statusText =
      html.match(/"shipmentStatus"\s*:\s*"([^"]+)"/)?.[1] ??
      html.match(/class="[^"]*shipment-status[^"]*"[^>]*>([^<]+)</i)?.[1] ??
      "";
    const status = normalizeShipmentStatus(statusText);

    const nativeCarrier =
      normalizeCarrierHint(nativeCarrierMatch) ??
      detectCarrierFromTrackingNumber(nativeTrackingMatch);

    const events: ScrapedEvent[] = [];
    if (nativeTrackingMatch) {
      events.push({
        occurredAt: new Date(),
        status,
        description: nativeCarrier
          ? `Sweetwater linked ${nativeCarrier.toUpperCase()} tracking ${nativeTrackingMatch}`
          : `Sweetwater linked tracking ${nativeTrackingMatch}`,
        location: null,
        dedupeKey: stableDedupeKey(["sweetwater", "link", nativeTrackingMatch]),
      });
    }

    return {
      ok: true,
      carrier: nativeCarrier ?? "sweetwater",
      status: status === ShipmentStatus.unknown ? ShipmentStatus.in_transit : status,
      estimatedDelivery: null,
      deliveredAt: status === ShipmentStatus.delivered ? new Date() : null,
      events,
      raw: {
        nativeCarrier,
        nativeTrackingNumber: nativeTrackingMatch,
      },
    };
  } catch (error) {
    return failure(`Sweetwater scrape error: ${(error as Error).message}`, true);
  }
};
