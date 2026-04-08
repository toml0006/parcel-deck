import { ShipmentStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { getShipmentStatusRank, normalizeShipmentStatus } from "./status";
import {
  type DashboardShipment,
  dashboardShipmentArgs,
  shipmentDetailArgs,
} from "./types";

function buildSearchWhere(query: string): Prisma.ShipmentWhereInput {
  return {
    OR: [
      {
        merchant: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        itemSummary: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        orderNumber: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        trackingNumber: {
          contains: query,
          mode: "insensitive",
        },
      },
    ],
  };
}

function sortShipments(shipments: DashboardShipment[]) {
  return shipments.sort((left, right) => {
    const rankDifference =
      getShipmentStatusRank(left.currentStatus) - getShipmentStatusRank(right.currentStatus);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const leftEta = left.estimatedDelivery?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightEta = right.estimatedDelivery?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (leftEta !== rightEta) {
      return leftEta - rightEta;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

function buildDefaultWindow(): Prisma.ShipmentWhereInput {
  const recentThreshold = new Date();
  recentThreshold.setDate(recentThreshold.getDate() - 14);

  return {
    OR: [
      {
        active: true,
      },
      {
        currentStatus: ShipmentStatus.delivered,
        deliveredAt: {
          gte: recentThreshold,
        },
      },
      {
        updatedAt: {
          gte: recentThreshold,
        },
      },
    ],
  };
}

export async function getDashboardData(filters: {
  q?: string | null;
  status?: string | null;
}) {
  try {
    const normalizedStatus =
      filters.status && filters.status !== "all"
        ? normalizeShipmentStatus(filters.status)
        : null;
    const where: Prisma.ShipmentWhereInput = {
      AND: [
        buildDefaultWindow(),
        filters.q ? buildSearchWhere(filters.q) : {},
        normalizedStatus
          ? {
              currentStatus: normalizedStatus,
            }
          : {},
      ],
    };

    const shipments = sortShipments(await prisma.shipment.findMany({
      ...dashboardShipmentArgs,
      where,
    }));

    const now = new Date();
    const stats = {
      active: shipments.filter((shipment) => shipment.active).length,
      attention: shipments.filter((shipment) => shipment.currentStatus === ShipmentStatus.exception)
        .length,
      deliveredRecently: shipments.filter(
        (shipment) =>
          shipment.currentStatus === ShipmentStatus.delivered &&
          shipment.deliveredAt &&
          shipment.deliveredAt.getTime() > now.getTime() - 1000 * 60 * 60 * 24 * 7,
      ).length,
      outToday: shipments.filter(
        (shipment) => shipment.currentStatus === ShipmentStatus.out_for_delivery,
      ).length,
    };

    return {
      error: null,
      shipments,
      stats,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load shipments.",
      shipments: [] as DashboardShipment[],
      stats: {
        active: 0,
        attention: 0,
        deliveredRecently: 0,
        outToday: 0,
      },
    };
  }
}

export async function getShipmentDetail(shipmentId: string) {
  try {
    return {
      error: null,
      shipment: await prisma.shipment.findUnique({
        ...shipmentDetailArgs,
        where: {
          id: shipmentId,
        },
      }),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load shipment.",
      shipment: null,
    };
  }
}

export async function listShipments(filters: {
  active?: boolean;
  q?: string | null;
  status?: string | null;
}) {
  const normalizedStatus =
    filters.status && filters.status !== "all" ? normalizeShipmentStatus(filters.status) : null;

  return prisma.shipment.findMany({
    ...dashboardShipmentArgs,
    where: {
      AND: [
        typeof filters.active === "boolean"
          ? {
              active: filters.active,
            }
          : {},
        filters.q ? buildSearchWhere(filters.q) : {},
        normalizedStatus
          ? {
              currentStatus: normalizedStatus,
            }
          : {},
      ],
    },
  });
}
