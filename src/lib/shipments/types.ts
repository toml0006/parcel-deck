import type { Prisma } from "@prisma/client";

export const dashboardShipmentArgs = {
  include: {
    artifacts: {
      orderBy: {
        createdAt: "asc",
      },
    },
    events: {
      orderBy: {
        occurredAt: "desc",
      },
      take: 3,
    },
  },
} satisfies Prisma.ShipmentDefaultArgs;

export type DashboardShipment = Prisma.ShipmentGetPayload<typeof dashboardShipmentArgs>;

export const shipmentDetailArgs = {
  include: {
    artifacts: {
      orderBy: {
        createdAt: "asc",
      },
    },
    events: {
      orderBy: {
        occurredAt: "desc",
      },
    },
    sourceRecords: {
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    },
  },
} satisfies Prisma.ShipmentDefaultArgs;

export type ShipmentDetail = Prisma.ShipmentGetPayload<typeof shipmentDetailArgs>;
