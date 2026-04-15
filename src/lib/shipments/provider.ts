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
import { scrapeCarrier } from "./scrapers";
import { isActiveShipmentStatus } from "./status";

type RefreshResult = {
  carrier?: string | null;
  currentStatus?: ShipmentStatus;
  deliveredAt?: Date | null;
  estimatedDelivery?: Date | null;
  events?: ShipmentTrackingEvent[];
  metadata?: Prisma.InputJsonValue;
  providerTrackingId?: string | null;
  trackingNumber?: string | null;
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

const scraperProvider: TrackingProvider = {
  async createOrBindTracking(shipment) {
    return {
      trackingUrl:
        shipment?.trackingUrl ??
        buildTrackingUrl(
          shipment?.carrier,
          shipment?.trackingNumberNormalized ?? shipment?.trackingNumber,
        ),
      metadata: { provider: "scraper" },
    };
  },
  async refreshTracking(shipment) {
    if (!shipment) return {};
    const trackingNumber =
      shipment.trackingNumberNormalized ?? shipment.trackingNumber ?? null;
    const result = await scrapeCarrier(shipment.carrier, trackingNumber, {
      trackingUrl: shipment.trackingUrl,
      merchant: shipment.merchant,
      orderNumber: shipment.orderNumber,
    });

    if (!result.ok) {
      return {
        metadata: {
          provider: "scraper",
          lastScrapeError: result.error,
          lastScrapeAt: new Date().toISOString(),
          lastScrapeTransient: result.transient,
        },
        // Preserve existing trackingUrl if any
        trackingUrl:
          shipment.trackingUrl ??
          buildTrackingUrl(
            shipment.carrier,
            shipment.trackingNumberNormalized ?? shipment.trackingNumber,
          ),
      };
    }

    const events: ShipmentTrackingEvent[] = result.events.map((e) => ({
      dedupeKey: e.dedupeKey,
      description: e.description,
      location: e.location ?? null,
      occurredAt: e.occurredAt,
      source: `scraper:${result.carrier}`,
      status: e.status,
      metadata: undefined,
    }));

    // Preserve awaiting_carrier status from ingest for amazon_orders only
    // when the scraper could not produce a real carrier status (placeholder
    // "awaiting_carrier" from the no-op path). When the Amazon progress
    // tracker returns a concrete status, honor it.
    const currentStatus =
      shipment.carrier === "amazon_orders" &&
      (result.status as unknown as string) === "awaiting_carrier"
        ? shipment.currentStatus
        : result.status;

    // Sweetwater/other scrapers may hand off to a native carrier by returning
    // a different carrier than the shipment currently has. Detect and persist.
    const resolvedCarrier =
      result.carrier && result.carrier !== shipment.carrier
        ? result.carrier
        : shipment.carrier;
    const scraperRaw = (result as unknown as { raw?: { nativeTrackingNumber?: string | null } }).raw;
    const handoffTrackingNumber = scraperRaw?.nativeTrackingNumber ?? null;

    return {
      carrier: resolvedCarrier,
      currentStatus,
      deliveredAt: result.deliveredAt ?? undefined,
      estimatedDelivery: result.estimatedDelivery ?? undefined,
      events,
      metadata: {
        provider: "scraper",
        lastScrapeAt: new Date().toISOString(),
        lastScrapeError: null,
      },
      trackingNumber:
        handoffTrackingNumber && resolvedCarrier !== shipment.carrier
          ? handoffTrackingNumber
          : undefined,
      trackingUrl:
        resolvedCarrier !== shipment.carrier
          ? buildTrackingUrl(
              resolvedCarrier,
              handoffTrackingNumber ??
                shipment.trackingNumberNormalized ??
                shipment.trackingNumber,
            ) ?? shipment.trackingUrl
          : shipment.trackingUrl ??
            buildTrackingUrl(
              resolvedCarrier,
              shipment.trackingNumberNormalized ?? shipment.trackingNumber,
            ),
    };
  },
};

function getTrackingProvider(kind: ProviderKind): TrackingProvider {
  if (kind === ProviderKind.easypost) {
    return easyPostProvider;
  }
  if (kind === ProviderKind.scraper) {
    return scraperProvider;
  }
  // For legacy carrier_link (and unknown kinds) fall back based on env.
  if (env.trackingProvider === "easypost" && env.easyPostApiKey) {
    return easyPostProvider;
  }
  // Default to scraper unless explicitly configured to carrier_link.
  if (env.trackingProvider !== "carrier_link") {
    return scraperProvider;
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
    let effectiveCarrier = nextCarrier;
    let effectiveTrackingNumber = result.trackingNumber ?? shipment.trackingNumber;
    let effectiveTrackingNumberNormalized =
      result.trackingNumber != null
        ? normalizeTrackingNumber(result.trackingNumber)
        : shipment.trackingNumberNormalized ??
          normalizeTrackingNumber(shipment.trackingNumber);
    let effectiveTrackingUrl =
      result.trackingUrl ??
      shipment.trackingUrl ??
      buildTrackingUrl(effectiveCarrier, effectiveTrackingNumberNormalized);

    // Guard against colliding with another shipment on the
    // (carrier, tracking_number) unique index when refreshing a handoff.
    // Triggered whenever the (carrier, tracking_number) pair changes at all.
    const carrierChanged =
      effectiveCarrier && effectiveCarrier !== shipment.carrier;
    const trackingChanged =
      effectiveTrackingNumberNormalized !== shipment.trackingNumberNormalized;
    if (
      (carrierChanged || trackingChanged) &&
      effectiveCarrier &&
      effectiveTrackingNumberNormalized
    ) {
      const existing = await tx.shipment.findUnique({
        where: {
          carrier_trackingNumberNormalized: {
            carrier: effectiveCarrier,
            trackingNumberNormalized: effectiveTrackingNumberNormalized,
          },
        },
        select: { id: true },
      });
      if (existing && existing.id !== shipment.id) {
        // Another shipment already owns this (carrier, tracking_number).
        // Revert the handoff entirely — carrier, tracking, and URL — so we
        // leave the current row untouched from an identity standpoint.
        effectiveCarrier = shipment.carrier;
        effectiveTrackingNumber = shipment.trackingNumber;
        effectiveTrackingNumberNormalized = shipment.trackingNumberNormalized;
        effectiveTrackingUrl =
          shipment.trackingUrl ??
          buildTrackingUrl(effectiveCarrier, effectiveTrackingNumberNormalized);
      }
    }

    await tx.shipment.update({
      where: {
        id: shipment.id,
      },
      data: {
        active: isActiveShipmentStatus(nextStatus),
        carrier: effectiveCarrier,
        currentStatus: nextStatus,
        deliveredAt: nextDeliveredAt,
        estimatedDelivery: result.estimatedDelivery ?? shipment.estimatedDelivery,
        lastEventAt: latestEventAt,
        lastSyncedAt: new Date(),
        metadata: mergeMetadata(shipment.metadata, result.metadata),
        providerTrackingId: result.providerTrackingId ?? shipment.providerTrackingId,
        trackingNumber: effectiveTrackingNumber,
        trackingNumberNormalized: effectiveTrackingNumberNormalized,
        trackingUrl: effectiveTrackingUrl,
      },
    });

    await upsertTrackingArtifact(tx, {
      carrier: effectiveCarrier,
      shipmentId: shipment.id,
      trackingUrl: effectiveTrackingUrl,
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

const ACTIVE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.exception,
  ShipmentStatus.out_for_delivery,
  ShipmentStatus.in_transit,
  ShipmentStatus.label_created,
  ShipmentStatus.pending,
  ShipmentStatus.awaiting_carrier,
  ShipmentStatus.unknown,
];

const PRIORITY_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.exception,
  ShipmentStatus.out_for_delivery,
]);

async function runInParallel<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runRefreshCycle(limit = 50) {
  const now = Date.now();
  const thirtyMinAgo = new Date(now - 30 * 60 * 1000);

  const candidates = await prisma.shipment.findMany({
    where: {
      active: true,
      currentStatus: { in: ACTIVE_STATUSES },
    },
    orderBy: [{ lastSyncedAt: "asc" }, { updatedAt: "asc" }],
    take: limit * 2,
  });

  const eligible = candidates.filter((s) => {
    if (PRIORITY_STATUSES.has(s.currentStatus)) return true;
    // Active tier: only if stale (>30 min) or never synced.
    return !s.lastSyncedAt || s.lastSyncedAt < thirtyMinAgo;
  });

  // Sort: priority tier first, then by lastSyncedAt asc.
  eligible.sort((a, b) => {
    const aPrio = PRIORITY_STATUSES.has(a.currentStatus) ? 0 : 1;
    const bPrio = PRIORITY_STATUSES.has(b.currentStatus) ? 0 : 1;
    if (aPrio !== bPrio) return aPrio - bPrio;
    const aSync = a.lastSyncedAt?.getTime() ?? 0;
    const bSync = b.lastSyncedAt?.getTime() ?? 0;
    return aSync - bSync;
  });

  const batch = eligible.slice(0, limit);

  await runInParallel(batch, 4, async (shipment) => {
    try {
      await refreshShipment(shipment.id);
    } catch (error) {
      console.error(`refresh failed for ${shipment.id}:`, (error as Error).message);
    }
  });

  return {
    refreshed: batch.length,
    considered: candidates.length,
  };
}
