import {
  type Prisma,
  ProviderKind,
  ShipmentStatus,
} from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

import { buildTrackingUrl } from "./carriers";
import { isActiveShipmentStatus } from "./status";

type RefreshEvent = {
  dedupeKey: string;
  description: string;
  occurredAt: Date;
  status: ShipmentStatus;
  location?: string | null;
  metadata?: Prisma.InputJsonValue;
  source?: string | null;
};

type RefreshResult = {
  currentStatus?: ShipmentStatus;
  deliveredAt?: Date | null;
  estimatedDelivery?: Date | null;
  metadata?: Prisma.InputJsonValue;
  trackingUrl?: string | null;
  events?: RefreshEvent[];
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

const carrierLinkProvider: TrackingProvider = {
  async createOrBindTracking(shipment) {
    return {
      trackingUrl:
        shipment?.trackingUrl ??
        buildTrackingUrl(shipment?.carrier, shipment?.trackingNumberNormalized ?? shipment?.trackingNumber),
    };
  },
  async refreshTracking(shipment) {
    return {
      trackingUrl:
        shipment?.trackingUrl ??
        buildTrackingUrl(shipment?.carrier, shipment?.trackingNumberNormalized ?? shipment?.trackingNumber),
      metadata: {
        lastRefreshProvider: "carrier_link",
      },
    };
  },
};

const aggregatorProvider: TrackingProvider = {
  async createOrBindTracking(shipment) {
    if (!env.trackingProviderApiKey) {
      return carrierLinkProvider.createOrBindTracking(shipment);
    }

    return {
      trackingUrl:
        shipment?.trackingUrl ??
        buildTrackingUrl(shipment?.carrier, shipment?.trackingNumberNormalized ?? shipment?.trackingNumber),
      metadata: {
        lastRefreshProvider: "aggregator",
        providerMode: "stubbed",
      },
    };
  },
  async refreshTracking(shipment) {
    if (!env.trackingProviderApiKey) {
      return carrierLinkProvider.refreshTracking(shipment);
    }

    return {
      trackingUrl:
        shipment?.trackingUrl ??
        buildTrackingUrl(shipment?.carrier, shipment?.trackingNumberNormalized ?? shipment?.trackingNumber),
      metadata: {
        lastRefreshProvider: "aggregator",
        providerMode: "stubbed",
      },
    };
  },
};

function getTrackingProvider(kind: ProviderKind): TrackingProvider {
  if (kind === ProviderKind.aggregator) {
    return aggregatorProvider;
  }

  return carrierLinkProvider;
}

export async function bindShipmentTracking(shipmentId: string) {
  const shipment = await getShipmentForRefresh(shipmentId);

  if (!shipment) {
    return null;
  }

  const provider = getTrackingProvider(shipment.providerKind);
  const result = await provider.createOrBindTracking(shipment);

  await prisma.shipment.update({
    where: {
      id: shipment.id,
    },
    data: {
      trackingUrl: result.trackingUrl ?? shipment.trackingUrl,
    },
  });

  return result;
}

export async function refreshShipment(shipmentId: string) {
  const shipment = await getShipmentForRefresh(shipmentId);

  if (!shipment) {
    return null;
  }

  const provider = getTrackingProvider(shipment.providerKind);
  const result = await provider.refreshTracking(shipment);
  const nextStatus = result.currentStatus ?? shipment.currentStatus;
  const nextDeliveredAt =
    result.deliveredAt ??
    shipment.deliveredAt ??
    (nextStatus === ShipmentStatus.delivered ? new Date() : null);

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: {
        id: shipment.id,
      },
      data: {
        active: isActiveShipmentStatus(nextStatus),
        currentStatus: nextStatus,
        deliveredAt: nextDeliveredAt,
        estimatedDelivery: result.estimatedDelivery ?? shipment.estimatedDelivery,
        lastSyncedAt: new Date(),
        trackingUrl: result.trackingUrl ?? shipment.trackingUrl,
        ...(result.metadata !== undefined
          ? {
              metadata: result.metadata,
            }
          : {}),
      },
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
