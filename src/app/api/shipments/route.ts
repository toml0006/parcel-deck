import { NextRequest, NextResponse } from "next/server";

import { listShipments } from "@/lib/shipments/queries";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get("active");
    const shipments = await listShipments({
      active: active === null ? undefined : active === "true",
      q: searchParams.get("q"),
      status: searchParams.get("status"),
    });

    return NextResponse.json({
      count: shipments.length,
      shipments,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to list shipments.",
      },
      {
        status: 500,
      },
    );
  }
}
