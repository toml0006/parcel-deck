import { ShipmentStatus, type Prisma } from "@prisma/client";

import { env } from "@/lib/env";

import { getCarrierLabel, normalizeCarrierHint, normalizeTrackingNumber } from "./carriers";

type EasyPostTrackingLocation = {
  city?: string | null;
  country?: string | null;
  state?: string | null;
  zip?: string | null;
};

type EasyPostTrackingDetail = {
  datetime?: string | null;
  message?: string | null;
  source?: string | null;
  status?: string | null;
  tracking_location?: EasyPostTrackingLocation | null;
};

export type EasyPostTracker = {
  carrier?: string | null;
  carrier_detail?: {
    est_delivery_date_local?: string | null;
    est_delivery_time_local?: string | null;
  } | null;
  est_delivery_date?: string | null;
  id: string;
  public_url?: string | null;
  shipment_id?: string | null;
  signed_by?: string | null;
  status?: string | null;
  tracking_code?: string | null;
  tracking_details?: EasyPostTrackingDetail[] | null;
  updated_at?: string | null;
};

export type ShipmentTrackingEvent = {
  dedupeKey: string;
  description: string;
  occurredAt: Date;
  status: ShipmentStatus;
  location?: string | null;
  metadata?: Prisma.InputJsonValue;
  source?: string | null;
};

export type ShipmentTrackingUpdate = {
  carrier?: string | null;
  currentStatus: ShipmentStatus;
  deliveredAt?: Date | null;
  estimatedDelivery?: Date | null;
  events: ShipmentTrackingEvent[];
  metadata: Prisma.InputJsonValue;
  providerTrackingId: string;
  trackingUrl?: string | null;
};

const easyPostCarrierMap: Record<string, string> = {
  amazon_logistics: "AmazonShipping",
  dhl: "DHLExpress",
  fedex: "FedEx",
  lasership: "LaserShipV2",
  ontrac: "OnTrac",
  ups: "UPS",
  usps: "USPS",
};

const easyPostStatusMap: Record<string, ShipmentStatus> = {
  available_for_pickup: ShipmentStatus.out_for_delivery,
  delivered: ShipmentStatus.delivered,
  error: ShipmentStatus.exception,
  failure: ShipmentStatus.exception,
  in_transit: ShipmentStatus.in_transit,
  out_for_delivery: ShipmentStatus.out_for_delivery,
  pending: ShipmentStatus.pending,
  pre_transit: ShipmentStatus.label_created,
  return_to_sender: ShipmentStatus.returned,
  unknown: ShipmentStatus.unknown,
};

function getEasyPostAuthHeader() {
  const token = Buffer.from(`${env.easyPostApiKey}:`).toString("base64");
  return `Basic ${token}`;
}

async function easyPostRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!env.easyPostApiKey) {
    throw new Error("EASYPOST_API_KEY is required for EasyPost tracking.");
  }

  const response = await fetch(`https://api.easypost.com/v2${path}`, {
    ...init,
    headers: {
      authorization: getEasyPostAuthHeader(),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : (null as T);

  if (!response.ok) {
    throw new Error(
      `EasyPost request failed (${response.status} ${response.statusText}): ${text}`,
    );
  }

  return payload;
}

export function getEasyPostCarrierCode(carrier?: string | null) {
  if (!carrier) {
    return undefined;
  }

  const normalized = normalizeCarrierHint(carrier);

  return normalized ? easyPostCarrierMap[normalized] : undefined;
}

export async function createEasyPostTracker(params: {
  carrier?: string | null;
  trackingNumber?: string | null;
}) {
  const trackingCode = normalizeTrackingNumber(params.trackingNumber);

  if (!trackingCode) {
    return null;
  }

  const tracker = await easyPostRequest<{ tracker: EasyPostTracker }>("/trackers", {
    body: JSON.stringify({
      tracker: {
        ...(params.carrier ? { carrier: getEasyPostCarrierCode(params.carrier) } : {}),
        tracking_code: trackingCode,
      },
    }),
    method: "POST",
  });

  return tracker.tracker;
}

export async function retrieveEasyPostTracker(providerTrackingId: string) {
  const tracker = await easyPostRequest<EasyPostTracker>(`/trackers/${providerTrackingId}`);

  return tracker;
}

function mapEasyPostStatus(status?: string | null) {
  if (!status) {
    return ShipmentStatus.unknown;
  }

  return easyPostStatusMap[status] ?? ShipmentStatus.unknown;
}

function formatTrackingLocation(location?: EasyPostTrackingLocation | null) {
  if (!location) {
    return null;
  }

  const parts = [location.city, location.state, location.zip, location.country].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function buildTrackingEvents(tracker: EasyPostTracker): ShipmentTrackingEvent[] {
  const details = tracker.tracking_details ?? [];
  const events: ShipmentTrackingEvent[] = [];

  for (const [index, detail] of details.entries()) {
      const occurredAt = detail.datetime ? new Date(detail.datetime) : null;

      if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
        continue;
      }

      const status = mapEasyPostStatus(detail.status);
      const description =
        detail.message?.trim() ||
        `${getCarrierLabel(tracker.carrier)} reported ${status.replace(/_/g, " ")}`;

      events.push({
        dedupeKey: `easypost:${tracker.id}:${detail.datetime}:${detail.status ?? "unknown"}:${index}`,
        description,
        location: formatTrackingLocation(detail.tracking_location),
        metadata: {
          rawStatus: detail.status ?? null,
          trackerId: tracker.id,
        },
        occurredAt,
        source: detail.source ?? "easypost",
        status,
      });
  }

  return events.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}

export function buildEasyPostTrackingUpdate(tracker: EasyPostTracker): ShipmentTrackingUpdate {
  const currentStatus = mapEasyPostStatus(tracker.status);
  const events = buildTrackingEvents(tracker);
  const deliveredAt =
    currentStatus === ShipmentStatus.delivered ? events[0]?.occurredAt ?? new Date() : null;
  const estimatedDelivery = tracker.est_delivery_date
    ? new Date(tracker.est_delivery_date)
    : null;

  return {
    carrier: normalizeCarrierHint(tracker.carrier) ?? tracker.carrier ?? null,
    currentStatus,
    deliveredAt,
    estimatedDelivery,
    events,
    metadata: {
      carrierLabel: getCarrierLabel(tracker.carrier),
      easyPostCarrier: tracker.carrier ?? null,
      easyPostShipmentId: tracker.shipment_id ?? null,
      easyPostSignedBy: tracker.signed_by ?? null,
      lastRefreshProvider: "easypost",
      provider: "easypost",
      trackerStatus: tracker.status ?? null,
      updatedAt: tracker.updated_at ?? null,
    },
    providerTrackingId: tracker.id,
    trackingUrl: tracker.public_url ?? null,
  };
}

export function extractEasyPostTrackerFromEvent(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeEvent = payload as {
    description?: string;
    result?: EasyPostTracker;
  };

  if (maybeEvent.result && typeof maybeEvent.result === "object") {
    return maybeEvent.result;
  }

  if ("id" in (payload as Record<string, unknown>)) {
    return payload as EasyPostTracker;
  }

  return null;
}
