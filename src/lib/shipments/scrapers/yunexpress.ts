import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  stableDedupeKey,
} from "./types";

const API_ENDPOINT = "https://services.yuntrack.com/Track/Query";

type YuntrackTraceDetail = {
  ProcessDate?: string;
  ProcessLocation?: string;
  ProcessContent?: string;
  StatusName?: string;
};

type YuntrackItem = {
  TrackingNumber?: string;
  CurrentStatusName?: string;
  CurrentStatusCategory?: string;
  DeliveredTime?: string;
  EstimatedDeliveryTime?: string;
  TrackingDetails?: YuntrackTraceDetail[];
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

export const yunexpressScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://www.yuntrack.com",
        Referer: "https://www.yuntrack.com/parcelTracking",
      },
      body: JSON.stringify({ NumberList: [trackingNumber], CaptchaVerification: "" }),
    });

    if (!res.ok) return failure(`YunExpress HTTP ${res.status}`, res.status >= 500);
    const json = (await res.json()) as { ResultList?: Array<{ WaybillNumber?: string; TrackData?: YuntrackItem }>; Item?: YuntrackItem[] };
    const item: YuntrackItem | undefined =
      json.ResultList?.[0]?.TrackData ?? json.Item?.[0];
    if (!item) return failure("YunExpress no data", true);

    const statusText = item.CurrentStatusCategory || item.CurrentStatusName || "";
    const status = normalizeShipmentStatus(statusText);
    if (!statusText || status === ShipmentStatus.unknown) {
      return failure(
        `YunExpress: unrecognized status "${statusText || "<empty>"}"`,
        true,
      );
    }
    const deliveredAt =
      status === ShipmentStatus.delivered
        ? parseDate(item.DeliveredTime) ?? new Date()
        : null;
    const estimatedDelivery = parseDate(item.EstimatedDeliveryTime);

    const events: ScrapedEvent[] = (item.TrackingDetails ?? [])
      .map((e): ScrapedEvent | null => {
        const occurredAt = parseDate(e.ProcessDate);
        if (!occurredAt) return null;
        const description = e.ProcessContent || e.StatusName || "Update";
        return {
          occurredAt,
          status: normalizeShipmentStatus(e.StatusName || description),
          description,
          location: e.ProcessLocation ?? null,
          dedupeKey: stableDedupeKey(["yunexpress", occurredAt.toISOString(), description]),
        } satisfies ScrapedEvent;
      })
      .filter((x): x is ScrapedEvent => x !== null)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      ok: true,
      carrier: "yunexpress",
      status,
      estimatedDelivery,
      deliveredAt,
      events,
    };
  } catch (error) {
    return failure(`YunExpress scrape error: ${(error as Error).message}`, true);
  }
};
