import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { authorizeIngestRequest, ingestShipment } from "@/lib/shipments/ingest";

export async function GET() {
  return NextResponse.json({
    auth: "Bearer token or x-ingest-token",
    endpoint: "/api/ingest/shipments",
    method: "POST",
    purpose: "Create or update shipments discovered by OpenClaw agents.",
  });
}

export async function POST(request: Request) {
  if (!authorizeIngestRequest(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const payload = await request.json();
    const result = await ingestShipment(payload);

    return NextResponse.json(result, {
      status: result.action === "created" ? 201 : 200,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          details: error.flatten(),
          error: "Invalid payload",
        },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to ingest shipment.",
      },
      {
        status: 500,
      },
    );
  }
}
