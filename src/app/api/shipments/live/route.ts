import { env } from "@/lib/env";
import { getShipmentsLiveCursor } from "@/lib/shipments/live";

export const dynamic = "force-dynamic";

function encodeEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const initialCursor = await getShipmentsLiveCursor();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let currentCursor = initialCursor.cursor;

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        controller.close();
      };

      request.signal.addEventListener("abort", close);
      controller.enqueue(encoder.encode(encodeEvent("ready", initialCursor)));

      while (!closed) {
        await new Promise((resolve) => setTimeout(resolve, env.liveRefreshIntervalMs));

        if (closed) {
          break;
        }

        const nextCursor = await getShipmentsLiveCursor();

        if (nextCursor.cursor !== currentCursor) {
          currentCursor = nextCursor.cursor;
          controller.enqueue(encoder.encode(encodeEvent("shipment-change", nextCursor)));
          continue;
        }

        controller.enqueue(encoder.encode(encodeEvent("ping", { now: Date.now() })));
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
