import { prisma } from "@/lib/prisma";

export async function getShipmentsLiveCursor() {
  const [latestShipment, latestEvent] = await prisma.$transaction([
    prisma.shipment.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        updatedAt: true,
      },
    }),
    prisma.shipmentEvent.findFirst({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        id: true,
      },
    }),
  ]);

  return {
    cursor: [
      latestShipment ? `${latestShipment.id}:${latestShipment.updatedAt.toISOString()}` : "none",
      latestEvent ? `${latestEvent.id}:${latestEvent.createdAt.toISOString()}` : "none",
    ].join("|"),
    latestEventAt: latestEvent?.createdAt.toISOString() ?? null,
    latestShipmentAt: latestShipment?.updatedAt.toISOString() ?? null,
  };
}
