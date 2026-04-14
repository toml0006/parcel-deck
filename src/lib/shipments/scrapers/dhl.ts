import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  stableDedupeKey,
} from "./types";

// DHL exposes a public tracking JSON endpoint under mydhl.express.dhl
const API = (n: string) =>
  `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(n)}`;

type DhlResponse = {
  shipments?: Array<{
    status?: { status?: string; description?: string; timestamp?: string };
    estimatedTimeOfDelivery?: string;
    events?: Array<{
      timestamp?: string;
      description?: string;
      location?: { address?: { addressLocality?: string } };
      statusCode?: string;
      status?: string;
    }>;
  }>;
};

export const dhlScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    // DHL API requires a key header. Without one, we fall back to the public HTML page.
    const html = await fetch(
      `https://www.dhl.com/us-en/home/tracking/tracking-ecommerce.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!html.ok) return failure(`DHL HTTP ${html.status}`, html.status >= 500);
    const text = await html.text();

    const statusMatch =
      text.match(/"shipmentStatus"\s*:\s*"([^"]+)"/i)?.[1] ??
      text.match(/<h[12][^>]*>([^<]*(?:deliver|transit|exception)[^<]*)<\/h[12]>/i)?.[1] ??
      "";
    const status = normalizeShipmentStatus(statusMatch);

    return {
      ok: true,
      carrier: "dhl",
      status,
      estimatedDelivery: null,
      deliveredAt: status === ShipmentStatus.delivered ? new Date() : null,
      events: [],
    };
  } catch (error) {
    return failure(`DHL scrape error: ${(error as Error).message}`, true);
  }
};

void API;
void ({} as DhlResponse);
