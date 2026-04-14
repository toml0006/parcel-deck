import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  stableDedupeKey,
} from "./types";

const TRACK_PAGE = "https://www.ups.com/track?loc=en_US";
const API_ENDPOINT = "https://webapis.ups.com/track/api/Track/GetStatus?loc=en_US";

type UpsShipment = {
  packageStatus?: string;
  packageStatusType?: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryTime?: string;
  deliveredDate?: string;
  deliveredTime?: string;
  activity?: Array<{
    date?: string;
    time?: string;
    location?: string;
    activityScan?: string;
    status?: { type?: string; description?: string };
  }>;
};

function parseDate(date?: string, time?: string): Date | null {
  if (!date) return null;
  let iso: string | null = null;
  if (/^\d{8}$/.test(date)) {
    iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    const [m, d, y] = date.split("/");
    iso = `${y}-${m}-${d}`;
  } else {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  }
  const t = time && /^\d{6}$/.test(time)
    ? `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`
    : time || "00:00:00";
  const d = new Date(`${iso}T${t}`);
  return isNaN(d.getTime()) ? null : d;
}

export const upsScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const primed = await fetch(TRACK_PAGE, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    const setCookie = primed.headers.get("set-cookie") ?? "";
    const cookies = setCookie
      .split(/,(?=[^;]+=[^;]+)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
    const xsrfMatch = /X-XSRF-TOKEN-ST=([^;]+)/.exec(setCookie);
    const xsrf = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : "";

    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Origin: "https://www.ups.com",
        Referer: `https://www.ups.com/track?tracknum=${trackingNumber}`,
        ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        ...(cookies ? { Cookie: cookies } : {}),
      },
      body: JSON.stringify({
        Locale: "en_US",
        TrackingNumber: [trackingNumber],
        Requester: "wt/trackdetails",
      }),
    });

    if (!res.ok) return failure(`UPS HTTP ${res.status}`, res.status >= 500);
    const json = (await res.json()) as {
      statusCode?: string;
      trackDetails?: UpsShipment[];
    };
    const detail = json.trackDetails?.[0];
    if (!detail) return failure("UPS no trackDetails", true);

    const status = normalizeShipmentStatus(
      detail.packageStatusType || detail.packageStatus || "",
    );
    const estimatedDelivery = parseDate(detail.scheduledDeliveryDate, detail.scheduledDeliveryTime);
    const deliveredAt =
      status === ShipmentStatus.delivered
        ? parseDate(detail.deliveredDate, detail.deliveredTime) ?? new Date()
        : null;

    const events: ScrapedEvent[] = (detail.activity ?? [])
      .map((a): ScrapedEvent | null => {
        const occurredAt = parseDate(a.date, a.time);
        if (!occurredAt) return null;
        const description = a.activityScan || a.status?.description || "Update";
        return {
          occurredAt,
          status: normalizeShipmentStatus(a.status?.type || description),
          description,
          location: a.location ?? null,
          dedupeKey: stableDedupeKey(["ups", occurredAt.toISOString(), description]),
        } satisfies ScrapedEvent;
      })
      .filter((x): x is ScrapedEvent => x !== null)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return { ok: true, carrier: "ups", status, estimatedDelivery, deliveredAt, events };
  } catch (error) {
    return failure(`UPS scrape error: ${(error as Error).message}`, true);
  }
};
