import {
  ArtifactKind,
  PrismaClient,
  ShipmentSource,
  ShipmentStatus,
} from "@prisma/client";
import { addDays, subDays, subHours } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  await prisma.sourceRecord.deleteMany();
  await prisma.shipmentArtifact.deleteMany();
  await prisma.shipmentEvent.deleteMany();
  await prisma.shipment.deleteMany();

  const now = new Date();

  await prisma.shipment.create({
    data: {
      active: true,
      carrier: "ups",
      currentStatus: ShipmentStatus.out_for_delivery,
      estimatedDelivery: addDays(now, 1),
      itemSummary: "Merino travel blazer",
      merchant: "Huckberry",
      orderNumber: "HB-2048",
      providerKind: "carrier_link",
      source: ShipmentSource.openclaw_email,
      sourceMessageId: "mail-hb-2048",
      trackingNumber: "1Z2048HUCKBERRY",
      trackingNumberNormalized: "1Z2048HUCKBERRY",
      trackingUrl: "https://www.ups.com/track?tracknum=1Z2048HUCKBERRY",
      artifacts: {
        create: [
          {
            key: "tracking",
            kind: ArtifactKind.tracking_link,
            label: "UPS tracking",
            url: "https://www.ups.com/track?tracknum=1Z2048HUCKBERRY",
          },
        ],
      },
      events: {
        create: [
          {
            dedupeKey: "seed-1-1",
            description: "Package loaded onto the local delivery vehicle",
            occurredAt: subHours(now, 3),
            status: ShipmentStatus.out_for_delivery,
          },
          {
            dedupeKey: "seed-1-2",
            description: "Arrived at destination facility",
            occurredAt: subHours(now, 11),
            status: ShipmentStatus.in_transit,
          },
        ],
      },
      sourceRecords: {
        create: [
          {
            checksum: "seed-record-1",
            payload: {
              merchant: "Huckberry",
              tracking_number: "1Z2048HUCKBERRY",
            },
            source: ShipmentSource.openclaw_email,
            sourceMessageId: "mail-hb-2048",
          },
        ],
      },
    },
  });

  await prisma.shipment.create({
    data: {
      active: true,
      carrier: "fedex",
      currentStatus: ShipmentStatus.in_transit,
      estimatedDelivery: addDays(now, 3),
      itemSummary: "Standing desk cable tray",
      merchant: "Uplift Desk",
      orderNumber: "UD-98214",
      providerKind: "carrier_link",
      source: ShipmentSource.openclaw_email,
      sourceMessageId: "mail-ud-98214",
      trackingNumber: "6129991103847777",
      trackingNumberNormalized: "6129991103847777",
      trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=6129991103847777",
      events: {
        create: [
          {
            dedupeKey: "seed-2-1",
            description: "Departed FedEx origin facility",
            occurredAt: subHours(now, 18),
            status: ShipmentStatus.in_transit,
          },
        ],
      },
      sourceRecords: {
        create: [
          {
            checksum: "seed-record-2",
            payload: {
              merchant: "Uplift Desk",
              tracking_number: "6129991103847777",
            },
            source: ShipmentSource.openclaw_email,
            sourceMessageId: "mail-ud-98214",
          },
        ],
      },
    },
  });

  await prisma.shipment.create({
    data: {
      active: true,
      carrier: "usps",
      currentStatus: ShipmentStatus.exception,
      estimatedDelivery: addDays(now, 2),
      itemSummary: "Vintage lens adapter",
      merchant: "eBay",
      orderNumber: "EB-771",
      providerKind: "carrier_link",
      rawEmailExcerpt:
        "USPS reported a delivery exception due to incomplete address details. Please verify.",
      source: ShipmentSource.openclaw_email,
      sourceMessageId: "mail-eb-771",
      trackingNumber: "9400111206213214512345",
      trackingNumberNormalized: "9400111206213214512345",
      trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111206213214512345",
      events: {
        create: [
          {
            dedupeKey: "seed-3-1",
            description: "Delivery exception recorded by USPS",
            occurredAt: subHours(now, 8),
            status: ShipmentStatus.exception,
          },
        ],
      },
      sourceRecords: {
        create: [
          {
            checksum: "seed-record-3",
            payload: {
              merchant: "eBay",
              tracking_number: "9400111206213214512345",
            },
            source: ShipmentSource.openclaw_email,
            sourceMessageId: "mail-eb-771",
          },
        ],
      },
    },
  });

  await prisma.shipment.create({
    data: {
      active: false,
      carrier: "dhl",
      currentStatus: ShipmentStatus.delivered,
      deliveredAt: subDays(now, 2),
      estimatedDelivery: subDays(now, 2),
      itemSummary: "Box of single-origin tea",
      merchant: "Tea Runners",
      orderNumber: "TR-1190",
      providerKind: "carrier_link",
      source: ShipmentSource.openclaw_email,
      sourceMessageId: "mail-tr-1190",
      trackingNumber: "JD014600003000000000",
      trackingNumberNormalized: "JD014600003000000000",
      trackingUrl:
        "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=JD014600003000000000",
      events: {
        create: [
          {
            dedupeKey: "seed-4-1",
            description: "Delivered to front door",
            occurredAt: subDays(now, 2),
            status: ShipmentStatus.delivered,
          },
          {
            dedupeKey: "seed-4-2",
            description: "Handed to local courier",
            occurredAt: subDays(now, 3),
            status: ShipmentStatus.in_transit,
          },
        ],
      },
      sourceRecords: {
        create: [
          {
            checksum: "seed-record-4",
            payload: {
              merchant: "Tea Runners",
              tracking_number: "JD014600003000000000",
            },
            source: ShipmentSource.openclaw_email,
            sourceMessageId: "mail-tr-1190",
          },
        ],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
