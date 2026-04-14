import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  stableDedupeKey,
} from "./types";

const PAGE = (n: string) =>
  `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`;

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function matchBetween(html: string, startRe: RegExp, endRe: RegExp): string | null {
  const start = startRe.exec(html);
  if (!start) return null;
  const tail = html.slice(start.index + start[0].length);
  const end = endRe.exec(tail);
  return end ? tail.slice(0, end.index) : tail;
}

export const uspsScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const res = await fetch(PAGE(trackingNumber), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return failure(`USPS HTTP ${res.status}`, res.status >= 500);
    const html = await res.text();

    const banner = matchBetween(
      html,
      /<h2[^>]*class="[^"]*(?:tracking-text|banner-title)[^"]*"[^>]*>/i,
      /<\/h2>/i,
    );
    const headline = banner ? stripTags(banner) : "";
    const status = normalizeShipmentStatus(headline);

    const events: ScrapedEvent[] = [];
    const rowRe = /<tr[^>]*class="[^"]*tb-[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let m: RegExpMatchArray | null;
    while ((m = rowRe.exec(html))) {
      const cells = m[1].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells || cells.length < 2) continue;
      const texts = cells.map((c) => stripTags(c));
      const dateText = texts[0];
      const statusText = texts[1];
      const location = texts[2] ?? null;
      const occurredAt = new Date(dateText);
      if (isNaN(occurredAt.getTime())) continue;
      events.push({
        occurredAt,
        status: normalizeShipmentStatus(statusText),
        description: statusText,
        location,
        dedupeKey: stableDedupeKey(["usps", occurredAt.toISOString(), statusText]),
      });
    }

    events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const deliveredAt =
      status === ShipmentStatus.delivered
        ? events.find((e) => e.status === ShipmentStatus.delivered)?.occurredAt ?? new Date()
        : null;

    return {
      ok: true,
      carrier: "usps",
      status,
      estimatedDelivery: null,
      deliveredAt,
      events,
    };
  } catch (error) {
    return failure(`USPS scrape error: ${(error as Error).message}`, true);
  }
};
