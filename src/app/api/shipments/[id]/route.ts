import { NextResponse } from "next/server";

import { getShipmentDetail } from "@/lib/shipments/queries";

type ShipmentRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: ShipmentRouteProps) {
  try {
    const { id } = await params;
    const data = await getShipmentDetail(id);

    if (data.error) {
      return NextResponse.json(
        {
          error: data.error,
        },
        {
          status: 500,
        },
      );
    }

    if (!data.shipment) {
      return NextResponse.json(
        {
          error: "Shipment not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      shipment: data.shipment,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch shipment.",
      },
      {
        status: 500,
      },
    );
  }
}
