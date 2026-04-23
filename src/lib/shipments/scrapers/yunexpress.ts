import { createHmac } from "crypto";

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
// Hardcoded signing key extracted from yuntrack.com frontend bundle
const SIGN_KEY = "f3c42837e3b46431ddf5d7db7d67017d";

// Numeric status codes used by the yuntrack.com API (as of 2026-04)
const YUNTRACK_STATUS: Record<number, string> = {
  0: "unknown",
  10: "in_transit",   // "Processing"
  20: "in_transit",   // "Transit"
  30: "in_transit",   // "Transit"
  40: "exception",    // "Alert"
  50: "delivered",    // "Delivered"
  60: "exception",    // "Alert"
  70: "exception",    // "Alert"
  90: "returned",     // "Returned"
  100: "exception",   // "Alert"
};

type YuntrackEvent = {
  ProcessDate?: string;
  CreatedOn?: string;
  ProcessLocation?: string;
  ProcessContent?: string;
  TrackingStatus?: number;
};

type YuntrackInfo = {
  WaybillNumber?: string;
  TrackingStatus?: number;
  LastTrackEvent?: YuntrackEvent;
  TrackEventDetails?: YuntrackEvent[];
  // Legacy fields (kept for fallback)
  CurrentStatusName?: string;
  CurrentStatusCategory?: string;
  DeliveredTime?: string;
  EstimatedDeliveryTime?: string;
  TrackingDetails?: YuntrackEvent[];
};

type YuntrackResult = {
  Id?: string;
  Status?: number;
  // New shape: TrackInfo
  TrackInfo?: YuntrackInfo;
  // Legacy shape: TrackData
  TrackData?: YuntrackInfo;
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function buildSignedBody(numbers: string[]) {
  const ts = Date.now();
  const msg = `Timestamp=${ts}&NumberList=${JSON.stringify(numbers)}`;
  const signature = createHmac("sha256", SIGN_KEY).update(msg).digest("hex");
  return { NumberList: numbers, CaptchaVerification: "", Year: 0, Timestamp: ts, Signature: signature };
}

function statusFromCode(code?: number): ShipmentStatus {
  if (code === undefined) return ShipmentStatus.unknown;
  const mapped = YUNTRACK_STATUS[code];
  return mapped ? normalizeShipmentStatus(mapped) : ShipmentStatus.unknown;
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
      body: JSON.stringify(buildSignedBody([trackingNumber])),
    });

    if (!res.ok) return failure(`YunExpress HTTP ${res.status}`, res.status >= 500);
    const json = (await res.json()) as { ResultList?: YuntrackResult[]; Item?: YuntrackInfo[] };

    const result = json.ResultList?.[0];
    if (!result) return failure("YunExpress no data", true);

    // New API shape uses TrackInfo; legacy shape used TrackData
    const info: YuntrackInfo | undefined = result.TrackInfo ?? result.TrackData;
    if (!info) return failure("YunExpress no data", true);

    // Prefer numeric status code; fall back to legacy text fields
    const status =
      statusFromCode(result.Status ?? info.TrackingStatus) !== ShipmentStatus.unknown
        ? statusFromCode(result.Status ?? info.TrackingStatus)
        : normalizeShipmentStatus(info.CurrentStatusCategory || info.CurrentStatusName || "");

    if (status === ShipmentStatus.unknown) {
      return failure(`YunExpress: unrecognized status (code=${result.Status})`, true);
    }

    const lastEvent = info.LastTrackEvent;
    const deliveredAt =
      status === ShipmentStatus.delivered
        ? parseDate(lastEvent?.ProcessDate ?? lastEvent?.CreatedOn ?? info.DeliveredTime) ?? new Date()
        : null;
    const estimatedDelivery = parseDate(info.EstimatedDeliveryTime);

    const rawEvents = info.TrackEventDetails ?? info.TrackingDetails ?? [];
    const events: ScrapedEvent[] = rawEvents
      .map((e): ScrapedEvent | null => {
        const occurredAt = parseDate(e.ProcessDate ?? e.CreatedOn);
        if (!occurredAt) return null;
        const description = e.ProcessContent || "Update";
        return {
          occurredAt,
          status: statusFromCode(e.TrackingStatus),
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
