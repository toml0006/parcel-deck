import {
  ArtifactKind,
  type Prisma,
  ProviderKind,
  ShipmentStatus,
} from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

import {
  buildTrackingUrl,
  getCarrierLabel,
  normalizeCarrierHint,
  normalizeTrackingNumber,
} from "./carriers";
import {
  buildEasyPostTrackingUpdate,
  createEasyPostTracker,
  extractEasyPostTrackerFromEvent,
  retrieveEasyPostTracker,
  type ShipmentTrackingEvent,
} from "./easypost";
import { isActiveShipmentStatus } from "./status";

type RefreshResult = {
  carrier?: string | null;
  currentStatus?: ShipmentStatus;
  deliveredAt?: Date | null;
  estimatedDelivery?: Date | null;
  events?: ShipmentTrackingEvent[];
  metadata?: Prisma.InputJsonValue;
  providerTrackingId?: string | null;
  trackingUrl?: string | null;
};

type ShipmentForRefresh = Awaited<ReturnType<typeof getShipmentForRefresh>>;

type TrackingProvider = {
  createOrBindTracking: (shipment: ShipmentForRefresh) => Promise<RefreshResult>;
  refreshTracking: (shipment: ShipmentForRefresh) => Promise<RefreshResult>;
};

async function getShipmentForRefresh(shipmentId: string) {
  return prisma.shipment.findUnique({
    where: {
      id: shipmentId,
    },
  });
}

function mergeMetadata(
  current: Prisma.JsonValue | null,
  next: Prisma.InputJsonValue | undefined,
) {
  if (next === undefined) {
    return current ?? undefined;
  }

  if (
    current &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    next &&
    typeof next === "object" &&
    !Array.isArray(next)
  ) {
    return {
      ...current,
      ...next,
    } satisfies Prisma.InputJsonValue;
  }

  return next;
}

async function upsertTrackingArtifact(tx: Prisma.TransactionClient, params: {
  carrier?: string | null;
  shipmentId: string;
  trackingUrl?: string | null;
}) {
  if (!params.trackingUrl) {
    return;
  }

  await tx.shipmentArtifact.upsert({
    where: {
      shipmentId_key: {
        key: "tracking",
        shipmentId: params.shipmentId,
      },
    },
    update: {
      kind: ArtifactKind.tracking_link,
      label: `${getCarrierLabel(params.carrier)} tracking`,
      url: params.trackingUrl,
    },
    create: {
      key: "tracking",
      kind: ArtifactKind.tracking_link,
      label: `${getCarrierLabel(params.carrier)} tracking`,
      shipmentId: params.shipmentId,
      url: params.trackingUrl,
    },
  });
}

const carrierLinkProvider: TrackingProvider = {
  async createOrBindTracking(shipment) {
    return {
      trackingUrl:
        shipment?.trackingUrl ??
        buildTrackingUrl(
          shipment?.carrier,
          shipment?.trackingNumberNormalized ?? shipment?.trackingNumber,
        ),
    };
  },
  async refreshTracking(shipment) {
    return {
      metadata: {
        lastRefreshProvider: "carrier_link",
        provider: "carrier_link",
      },
      trackingUrl:
        shipment?.trackingUrl ??
        buildTrackingUrl(
          shipment?.carrier,
          shipment?.trackingNumberNormalized ?? shipment?.trackingNumber,
        ),
    };
  },
};

const easyPostProvider: TrackingProvider = {
  async createOrBindTracking(shipment) {
    if (!shipment) {
      return {};
    }

    if (!env.easyPostApiKey || !shipment.trackingNumberNormalized) {
      return carrierLinkProvider.createOrBindTracking(shipment);
    }

    if (shipment.providerTrackingId) {
      const tracker = await retrieveEasyPostTracker(shipment.providerTrackingId);
      return buildEasyPostTrackingUpdate(tracker);
    }

    const tracker = await createEasyPostTracker({
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumberNormalized ?? shipment.trackingNumber,
    });

    if (!tracker) {
      return carrierLinkProvider.createOrBindTracking(shipment);
    }

    return buildEasyPostTrackingUpdate(tracker);
  },
  async refreshTracking(shipment) {
    if (!shipment) {
      return {};
    }

    if (!env.easyPostApiKey) {
      return carrierLinkProvider.refreshTracking(shipment);
    }

    const providerTrackingId = shipment.providerTrackingId;

    if (!providerTrackingId) {
      return easyPostProvider.createOrBindTracking(shipment);
    }

    const tracker = await retrieveEasyPostTracker(providerTrackingId);

    return buildEasyPostTrackingUpdate(tracker);
  },
};

function getTrackingProvider(kind: ProviderKind): TrackingProvider {
  if (kind === ProviderKind.easypost) {
    return easyPostProvider;
  }

  return carrierLinkProvider;
}

async function applyTrackingUpdate(
  shipment: NonNullable<ShipmentForRefresh>,
  result: RefreshResult,
) {
  const nextCarrier = result.carrier ?? shipment.carrier;
  const nextStatus = result.currentStatus ?? shipment.currentStatus;
  const nextDeliveredAt =
    result.deliveredAt ??
    shipment.deliveredAt ??
    (nextStatus === ShipmentStatus.delivered ? new Date() : null);
  const latestEventAt = result.events?.[0]?.occurredAt ?? shipment.lastEventAt;

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: {
        id: shipment.id,
      },
      data: {
        active: isActiveShipmentStatus(nextStatus),
        carrier: nextCarrier,
        currentStatus: nextStatus,
        deliveredAt: nextDeliveredAt,
        estimatedDelivery: result.estimatedDelivery ?? shipment.estimatedDelivery,
        lastEventAt: latestEventAt,
        lastSyncedAt: new Date(),
        metadata: mergeMetadata(shipment.metadata, result.metadata),
        providerTrackingId: result.providerTrackingId ?? shipment.providerTrackingId,
        trackingNumberNormalized:
          shipment.trackingNumberNormalized ??
          normalizeTrackingNumber(shipment.trackingNumber),
        trackingUrl:
          result.trackingUrl ??
          shipment.trackingUrl ??
          buildTrackingUrl(nextCarrier, shipment.trackingNumberNormalized ?? shipment.trackingNumber),
      },
    });

    await upsertTrackingArtifact(tx, {
      carrier: nextCarrier,
      shipmentId: shipment.id,
      trackingUrl:
        result.trackingUrl ??
        shipment.trackingUrl ??
        buildTrackingUrl(nextCarrier, shipment.trackingNumberNormalized ?? shipment.trackingNumber),
    });

    if (result.events?.length) {
      for (const event of result.events) {
        await tx.shipmentEvent.upsert({
          where: {
            shipmentId_dedupeKey: {
              dedupeKey: event.dedupeKey,
              shipmentId: shipment.id,
            },
          },
          update: {
            description: event.description,
            location: event.location,
            metadata: event.metadata,
            occurredAt: event.occurredAt,
            source: event.source,
            status: event.status,
          },
          create: {
            dedupeKey: event.dedupeKey,
            description: event.description,
            location: event.location,
            metadata: event.metadata,
            occurredAt: event.occurredAt,
            shipmentId: shipment.id,
            source: event.source,
            status: event.status,
          },
        });
      }
    }
  });
}

export function authorizeEasyPostWebhook(request: Request) {
  if (!env.easyPostWebhookSecret) {
    return false;
  }

  const providedSecret = request.headers.get("x-parcel-deck-webhook-token");

  return providedSecret === env.easyPostWebhookSecret;
}

export async function processEasyPostWebhook(payload: unknown) {
  const tracker = extractEasyPostTrackerFromEvent(payload);

  if (!tracker?.id) {
    return {
      action: "ignored" as const,
      reason: "No tracker payload found.",
    };
  }

  const trackingNumberNormalized = normalizeTrackingNumber(tracker.tracking_code);
  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        {
          providerTrackingId: tracker.id,
        },
        {
          carrier: normalizeCarrierHint(tracker.carrier) ?? undefined,
          trackingNumberNormalized: trackingNumberNormalized ?? undefined,
        },
      ],
    },
  });

  if (!shipment) {
    return {
      action: "ignored" as const,
      reason: "No shipment matched the EasyPost tracker update.",
      trackerId: tracker.id,
    };
  }

  await applyTrackingUpdate(shipment, buildEasyPostTrackingUpdate(tracker));

  return {
    action: "applied" as const,
    shipmentId: shipment.id,
    trackerId: tracker.id,
  };
}

export async function bindShipmentTracking(shipmentId: string) {
  const shipment = await getShipmentForRefresh(shipmentId);

  if (!shipment) {
    return null;
  }

  const provider = getTrackingProvider(shipment.providerKind);
  const result = await provider.createOrBindTracking(shipment);

  await applyTrackingUpdate(shipment, result);

  return result;
}

export async function refreshShipment(shipmentId: string) {
  const shipment = await getShipmentForRefresh(shipmentId);

  if (!shipment) {
    return null;
  }

  const provider = getTrackingProvider(shipment.providerKind);
  const result = await provider.refreshTracking(shipment);

  await applyTrackingUpdate(shipment, result);

  return result;
}

export async function runRefreshCycle(limit = 25) {
  const shipments = await prisma.shipment.findMany({
    where: {
      active: true,
    },
    orderBy: [
      {
        lastSyncedAt: "asc",
      },
      {
        updatedAt: "asc",
      },
    ],
    take: limit,
  });

  let refreshed = 0;

  for (const shipment of shipments) {
    await refreshShipment(shipment.id);
    refreshed += 1;
  }

  return {
    refreshed,
  };
}
