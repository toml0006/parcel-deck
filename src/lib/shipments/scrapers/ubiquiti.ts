import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  isAllowedUrl,
  stableDedupeKey,
} from "./types";

const UBIQUITI_HOSTS = ["store.ui.com", "ui.com"];

export const ubiquitiScraper: CarrierScraper = async ({ trackingUrl, orderNumber }) => {
  const url =
    trackingUrl ??
    (orderNumber ? `https://store.ui.com/us/en/order/${encodeURIComponent(orderNumber)}/status` : null);
  if (!url) return failure("Ubiquiti: no order URL", false);
  if (!isAllowedUrl(url, UBIQUITI_HOSTS)) return failure("Ubiquiti: URL host not allowed", false);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return failure(`Ubiquiti HTTP ${res.status}`, res.status >= 500);
    const html = await res.text();

    // Narrow, order-specific keys only — do not fall back to a generic
    // `"status"` match, which easily picks up unrelated JSON on the page.
    const statusRaw =
      html.match(/"orderStatus"\s*:\s*"([^"]+)"/)?.[1] ??
      html.match(/"fulfillmentStatus"\s*:\s*"([^"]+)"/)?.[1] ??
      html.match(/"shipmentStatus"\s*:\s*"([^"]+)"/)?.[1] ??
      "";

    if (!statusRaw) {
      return failure("Ubiquiti: order status not found", true);
    }

    const status = normalizeShipmentStatus(statusRaw);
    if (status === ShipmentStatus.unknown) {
      return failure(`Ubiquiti: unrecognized status "${statusRaw}"`, true);
    }
    const deliveredAtRaw = html.match(/"deliveredAt"\s*:\s*"([^"]+)"/)?.[1];
    const parsedDeliveredAt = deliveredAtRaw ? new Date(deliveredAtRaw) : null;
    const deliveredAt =
      status === ShipmentStatus.delivered
        ? parsedDeliveredAt && !isNaN(parsedDeliveredAt.getTime())
          ? parsedDeliveredAt
          : new Date()
        : null;

    const events: ScrapedEvent[] = [];
    const eventPattern = /"(?:eventDate|occurredAt|createdAt)"\s*:\s*"([^"]+)"[^}]*?"(?:label|description|status)"\s*:\s*"([^"]+)"/g;
    for (const match of html.matchAll(eventPattern)) {
      const occurredAt = new Date(match[1]);
      if (isNaN(occurredAt.getTime())) continue;
      events.push({
        occurredAt,
        status: normalizeShipmentStatus(match[2]),
        description: match[2],
        location: null,
        dedupeKey: stableDedupeKey(["ubiquiti", occurredAt.toISOString(), match[2]]),
      });
    }
    events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      ok: true,
      carrier: "ubiquiti",
      status,
      estimatedDelivery: null,
      deliveredAt,
      events,
    };
  } catch (error) {
    return failure(`Ubiquiti scrape error: ${(error as Error).message}`, true);
  }
};
