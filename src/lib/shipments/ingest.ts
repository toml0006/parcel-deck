import { createHash, timingSafeEqual } from "node:crypto";

import {
  ArtifactKind,
  ProviderKind,
  type Prisma,
  ShipmentSource,
  type Shipment,
  type ShipmentStatus,
} from "@prisma/client";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

import {
  buildTrackingUrl,
  getCarrierLabel,
  normalizeCarrierHint,
  normalizeTrackingNumber,
} from "./carriers";
import { bindShipmentTracking } from "./provider";
import { isActiveShipmentStatus, normalizeShipmentStatus } from "./status";

const ingestShipmentSchema = z
  .object({
    carrier_hint: z.string().trim().min(1).optional(),
    current_status: z.string().trim().min(1).optional(),
    estimated_delivery: z.coerce.date().optional(),
    external_id: z.string().trim().min(1).optional(),
    item_summary: z.string().trim().min(1).optional(),
    merchant: z.string().trim().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    order_number: z.string().trim().min(1).optional(),
    ordered_at: z.coerce.date().optional(),
    raw_email_excerpt: z.string().trim().min(1).max(4000).optional(),
    source: z.nativeEnum(ShipmentSource).default(ShipmentSource.openclaw_email),
    source_message_id: z.string().trim().min(1).optional(),
    tracking_number: z.string().trim().min(1).optional(),
    tracking_url: z.string().url().optional(),
  })
  .refine(
    (input) =>
      Boolean(
        input.external_id ||
          input.source_message_id ||
          input.tracking_number ||
          input.order_number,
      ),
    {
      message:
        "Provide at least one identifier: external_id, source_message_id, tracking_number, or order_number.",
      path: ["tracking_number"],
    },
  );

export type IngestShipmentInput = z.infer<typeof ingestShipmentSchema>;

export function parseIngestShipmentInput(rawPayload: unknown): IngestShipmentInput {
  return ingestShipmentSchema.parse(rawPayload);
}

type IngestResult = {
  action: "created" | "duplicate" | "updated";
  canonicalStatus: ShipmentStatus;
  shipmentId: string;
};

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorizeIngestRequest(request: Request) {
  if (!env.ingestSharedSecret) {
    return false;
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-ingest-token");
  const providedSecret = bearer || header;

  if (!providedSecret) {
    return false;
  }

  return safeEquals(providedSecret, env.ingestSharedSecret);
}

function getPayloadChecksum(payload: IngestShipmentInput) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function mergeMetadata(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!current && !next) {
    return undefined;
  }

  return {
    ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}),
    ...(next ?? {}),
    lastIngestedAt: new Date().toISOString(),
  };
}

function buildEventDescription(payload: IngestShipmentInput, created: boolean) {
  if (created) {
    return payload.merchant
      ? `Added from ${payload.merchant} shipping email`
      : "Added from shipping email";
  }

  if (payload.current_status) {
    return "Status updated from OpenClaw ingest";
  }

  if (payload.estimated_delivery) {
    return "Estimated delivery updated from OpenClaw ingest";
  }

  return "Shipment metadata refreshed from OpenClaw ingest";
}

async function upsertArtifacts(
  tx: Prisma.TransactionClient,
  shipment: Shipment,
  payload: IngestShipmentInput,
  trackingUrl: string | null,
) {
  const emailPermalink =
    typeof payload.metadata?.email_permalink === "string"
      ? payload.metadata.email_permalink
      : null;
  const merchantOrderUrl =
    typeof payload.metadata?.merchant_order_url === "string"
      ? payload.metadata.merchant_order_url
      : null;

  if (trackingUrl) {
    await tx.shipmentArtifact.upsert({
      where: {
        shipmentId_key: {
          key: "tracking",
          shipmentId: shipment.id,
        },
      },
      update: {
        kind: ArtifactKind.tracking_link,
        label: `${getCarrierLabel(shipment.carrier)} tracking`,
        url: trackingUrl,
      },
      create: {
        key: "tracking",
        kind: ArtifactKind.tracking_link,
        label: `${getCarrierLabel(shipment.carrier)} tracking`,
        shipmentId: shipment.id,
        url: trackingUrl,
      },
    });
  }

  if (emailPermalink) {
    await tx.shipmentArtifact.upsert({
      where: {
        shipmentId_key: {
          key: "source-email",
          shipmentId: shipment.id,
        },
      },
      update: {
        kind: ArtifactKind.source_email,
        label: "Source email",
        url: emailPermalink,
      },
      create: {
        key: "source-email",
        kind: ArtifactKind.source_email,
        label: "Source email",
        shipmentId: shipment.id,
        url: emailPermalink,
      },
    });
  }

  if (merchantOrderUrl) {
    await tx.shipmentArtifact.upsert({
      where: {
        shipmentId_key: {
          key: "merchant-order",
          shipmentId: shipment.id,
        },
      },
      update: {
        kind: ArtifactKind.merchant_order,
        label: "Merchant order",
        url: merchantOrderUrl,
      },
      create: {
        key: "merchant-order",
        kind: ArtifactKind.merchant_order,
        label: "Merchant order",
        shipmentId: shipment.id,
        url: merchantOrderUrl,
      },
    });
  }
}

async function findExistingShipment(
  tx: Prisma.TransactionClient,
  payload: IngestShipmentInput,
  carrier: string | null,
  trackingNumberNormalized: string | null,
) {
  if (carrier && trackingNumberNormalized) {
    const byTracking = await tx.shipment.findUnique({
      where: {
        carrier_trackingNumberNormalized: {
          carrier,
          trackingNumberNormalized,
        },
      },
    });

    if (byTracking) {
      return byTracking;
    }
  }

  if (payload.source_message_id) {
    const byMessage = await tx.sourceRecord.findUnique({
      where: {
        source_sourceMessageId: {
          source: payload.source,
          sourceMessageId: payload.source_message_id,
        },
      },
      include: {
        shipment: true,
      },
    });

    if (byMessage?.shipment) {
      return byMessage.shipment;
    }
  }

  if (payload.external_id) {
    const byExternalId = await tx.shipment.findFirst({
      where: {
        externalId: payload.external_id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (byExternalId) {
      return byExternalId;
    }
  }

  if (payload.merchant && payload.order_number) {
    return tx.shipment.findFirst({
      where: {
        merchant: {
          equals: payload.merchant,
          mode: "insensitive",
        },
        orderNumber: payload.order_number,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  return null;
}

export async function ingestShipment(rawPayload: unknown): Promise<IngestResult> {
  const payload = parseIngestShipmentInput(rawPayload);
  const checksum = getPayloadChecksum(payload);
  const carrier = normalizeCarrierHint(payload.carrier_hint);
  const trackingNumberNormalized = normalizeTrackingNumber(payload.tracking_number);
  const trackingUrl =
    payload.tracking_url ??
    buildTrackingUrl(carrier, trackingNumberNormalized ?? payload.tracking_number);
  const canonicalStatus = normalizeShipmentStatus(payload.current_status);

  const result = await prisma.$transaction(async (tx) => {
    const duplicateRecord = await tx.sourceRecord.findUnique({
      where: {
        source_checksum: {
          checksum,
          source: payload.source,
        },
      },
    });

    if (duplicateRecord) {
      const existingShipment = await tx.shipment.findUnique({
        where: {
          id: duplicateRecord.shipmentId,
        },
      });

      if (existingShipment) {
        return {
          action: "duplicate" as const,
          canonicalStatus: existingShipment.currentStatus,
          shipmentId: existingShipment.id,
        };
      }
    }

    const existingShipment = await findExistingShipment(
      tx,
      payload,
      carrier,
      trackingNumberNormalized,
    );
    const providerKind =
      env.trackingProvider === "easypost" && env.easyPostApiKey
        ? ProviderKind.easypost
        : ProviderKind.carrier_link;
    const eventOccurredAt = payload.estimated_delivery ?? payload.ordered_at ?? new Date();
    const deliveredAt =
      canonicalStatus === "delivered"
        ? existingShipment?.deliveredAt ?? eventOccurredAt
        : existingShipment?.deliveredAt;

    const shipment = existingShipment
      ? await tx.shipment.update({
          where: {
            id: existingShipment.id,
          },
          data: {
            active: isActiveShipmentStatus(canonicalStatus),
            carrier: carrier ?? existingShipment.carrier,
            currentStatus: canonicalStatus,
            deliveredAt,
            estimatedDelivery: payload.estimated_delivery ?? existingShipment.estimatedDelivery,
            externalId: payload.external_id ?? existingShipment.externalId,
            itemSummary: payload.item_summary ?? existingShipment.itemSummary,
            lastEventAt: eventOccurredAt,
            merchant: payload.merchant ?? existingShipment.merchant,
            metadata: mergeMetadata(existingShipment.metadata, payload.metadata),
            orderNumber: payload.order_number ?? existingShipment.orderNumber,
            orderedAt: payload.ordered_at ?? existingShipment.orderedAt,
            providerKind,
            rawEmailExcerpt: payload.raw_email_excerpt ?? existingShipment.rawEmailExcerpt,
            source: payload.source,
            sourceMessageId: payload.source_message_id ?? existingShipment.sourceMessageId,
            trackingNumber: payload.tracking_number ?? existingShipment.trackingNumber,
            trackingNumberNormalized:
              trackingNumberNormalized ?? existingShipment.trackingNumberNormalized,
            trackingUrl: trackingUrl ?? existingShipment.trackingUrl,
          },
        })
      : await tx.shipment.create({
          data: {
            active: isActiveShipmentStatus(canonicalStatus),
            carrier,
            currentStatus: canonicalStatus,
            deliveredAt,
            estimatedDelivery: payload.estimated_delivery,
            externalId: payload.external_id,
            itemSummary: payload.item_summary,
            lastEventAt: eventOccurredAt,
            merchant: payload.merchant,
            metadata: mergeMetadata(null, payload.metadata),
            orderNumber: payload.order_number,
            orderedAt: payload.ordered_at,
            providerKind,
            rawEmailExcerpt: payload.raw_email_excerpt,
            source: payload.source,
            sourceMessageId: payload.source_message_id,
            trackingNumber: payload.tracking_number,
            trackingNumberNormalized,
            trackingUrl,
          },
        });

    await upsertArtifacts(tx, shipment, payload, trackingUrl);

    await tx.sourceRecord.create({
      data: {
        checksum,
        externalId: payload.external_id,
        payload: payload as unknown as Prisma.InputJsonValue,
        shipmentId: shipment.id,
        source: payload.source,
        sourceMessageId: payload.source_message_id,
      },
    });

    await tx.shipmentEvent.upsert({
      where: {
        shipmentId_dedupeKey: {
          dedupeKey: `ingest:${checksum}`,
          shipmentId: shipment.id,
        },
      },
      update: {
        description: buildEventDescription(payload, !existingShipment),
        metadata: {
          kind: "openclaw_ingest",
          source_message_id: payload.source_message_id,
        },
        occurredAt: eventOccurredAt,
        source: payload.source,
        status: canonicalStatus,
      },
      create: {
        dedupeKey: `ingest:${checksum}`,
        description: buildEventDescription(payload, !existingShipment),
        metadata: {
          kind: "openclaw_ingest",
          source_message_id: payload.source_message_id,
        },
        occurredAt: eventOccurredAt,
        shipmentId: shipment.id,
        source: payload.source,
        status: canonicalStatus,
      },
    });

    return {
      action: existingShipment ? ("updated" as const) : ("created" as const),
      canonicalStatus,
      shipmentId: shipment.id,
    };
  });

  await bindShipmentTracking(result.shipmentId);

  return result;
}
