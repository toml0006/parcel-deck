import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  stableDedupeKey,
} from "./types";

const DETAIL_URL = (tn: string) =>
  `https://www.canadapost-postescanada.ca/track-reperage/rs/track/json/package/${encodeURIComponent(tn)}/detail`;

type CanadaPostEvent = {
  eventDateTime?: string;
  eventIdentifier?: string;
  eventDescriptionEn?: string;
  eventDescription?: string;
  eventSiteEn?: string;
  eventSite?: string;
};

type CanadaPostDetail = {
  pin?: string;
  statusName?: string;
  statusCategory?: string;
  expectedDeliveryDate?: string;
  deliveredDate?: string;
  significantEvents?: CanadaPostEvent[];
  events?: CanadaPostEvent[];
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export const canadaPostScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const res = await fetch(DETAIL_URL(trackingNumber), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Referer: "https://www.canadapost-postescanada.ca/track-reperage/en",
      },
    });

    if (!res.ok) return failure(`Canada Post HTTP ${res.status}`, res.status >= 500);
    const detail = (await res.json()) as CanadaPostDetail;

    const statusText = detail.statusCategory || detail.statusName || "";
    const status = normalizeShipmentStatus(statusText);
    if (!statusText || status === ShipmentStatus.unknown) {
      return failure(
        `Canada Post: unrecognized status "${statusText || "<empty>"}"`,
        true,
      );
    }
    const estimatedDelivery = parseDate(detail.expectedDeliveryDate);
    const deliveredAt =
      status === ShipmentStatus.delivered
        ? parseDate(detail.deliveredDate) ?? new Date()
        : null;

    const rawEvents = detail.significantEvents ?? detail.events ?? [];
    const events: ScrapedEvent[] = rawEvents
      .map((e): ScrapedEvent | null => {
        const occurredAt = parseDate(e.eventDateTime);
        if (!occurredAt) return null;
        const description = e.eventDescriptionEn || e.eventDescription || e.eventIdentifier || "Update";
        return {
          occurredAt,
          status: normalizeShipmentStatus(e.eventIdentifier || description),
          description,
          location: e.eventSiteEn || e.eventSite || null,
          dedupeKey: stableDedupeKey(["canadapost", occurredAt.toISOString(), description]),
        } satisfies ScrapedEvent;
      })
      .filter((x): x is ScrapedEvent => x !== null)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      ok: true,
      carrier: "canada_post",
      status,
      estimatedDelivery,
      deliveredAt,
      events,
    };
  } catch (error) {
    return failure(`Canada Post scrape error: ${(error as Error).message}`, true);
  }
};
