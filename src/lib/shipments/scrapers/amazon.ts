import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  stableDedupeKey,
} from "./types";

const PAGE = (id: string) => `https://track.amazon.com/tracking/${encodeURIComponent(id)}`;

type AmazonProgress = {
  summary?: { status?: string };
  promisedDeliveryDate?: string;
  deliveredAt?: string;
  eventHistory?: Array<{
    eventTime?: string;
    eventCode?: string;
    statusSummary?: { localisedStringId?: string };
    location?: { city?: string; stateProvince?: string; countryCode?: string };
    description?: string;
  }>;
};

export const amazonScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const res = await fetch(PAGE(trackingNumber), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return failure(`Amazon HTTP ${res.status}`, res.status >= 500);
    const html = await res.text();

    const dataMatch = html.match(/window\.__INITIAL_DATA__\s*=\s*(\{[\s\S]*?\});/m);
    let parsed: AmazonProgress | null = null;
    if (dataMatch) {
      try {
        const outer = JSON.parse(dataMatch[1]) as Record<string, unknown>;
        parsed = (outer.progressTracker as AmazonProgress) ?? (outer as AmazonProgress);
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      const rawStatus =
        html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] ??
        html.match(/"status":"([^"]+)"/i)?.[1] ??
        "";
      const status = normalizeShipmentStatus(rawStatus);
      return {
        ok: true,
        carrier: "amazon_logistics",
        status,
        estimatedDelivery: null,
        deliveredAt: status === ShipmentStatus.delivered ? new Date() : null,
        events: [],
      };
    }

    const rawStatus = parsed.summary?.status ?? "";
    const status = normalizeShipmentStatus(rawStatus);
    const estimatedDelivery = parsed.promisedDeliveryDate
      ? new Date(parsed.promisedDeliveryDate)
      : null;
    const deliveredAt = parsed.deliveredAt
      ? new Date(parsed.deliveredAt)
      : status === ShipmentStatus.delivered
        ? new Date()
        : null;

    const events: ScrapedEvent[] = (parsed.eventHistory ?? [])
      .map((e): ScrapedEvent | null => {
        if (!e.eventTime) return null;
        const occurredAt = new Date(e.eventTime);
        if (isNaN(occurredAt.getTime())) return null;
        const description =
          e.description || e.statusSummary?.localisedStringId || e.eventCode || "Update";
        const loc = [e.location?.city, e.location?.stateProvince].filter(Boolean).join(", ");
        return {
          occurredAt,
          status: normalizeShipmentStatus(e.eventCode || description),
          description,
          location: loc || null,
          dedupeKey: stableDedupeKey(["amazon", occurredAt.toISOString(), description]),
        } satisfies ScrapedEvent;
      })
      .filter((x): x is ScrapedEvent => x !== null)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      ok: true,
      carrier: "amazon_logistics",
      status,
      estimatedDelivery,
      deliveredAt,
      events,
    };
  } catch (error) {
    return failure(`Amazon scrape error: ${(error as Error).message}`, true);
  }
};
