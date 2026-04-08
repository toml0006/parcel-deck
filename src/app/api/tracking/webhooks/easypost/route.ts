import { NextResponse } from "next/server";

import {
  authorizeEasyPostWebhook,
  processEasyPostWebhook,
} from "@/lib/shipments/provider";

export async function POST(request: Request) {
  if (!authorizeEasyPostWebhook(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized webhook request",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const payload = await request.json();
    const result = await processEasyPostWebhook(payload);

    return NextResponse.json(result, {
      status: result.action === "applied" ? 202 : 200,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to process EasyPost webhook.",
      },
      {
        status: 500,
      },
    );
  }
}
