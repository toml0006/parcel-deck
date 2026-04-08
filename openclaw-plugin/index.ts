import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import {
  buildShipmentQuery,
  formatToolResult,
  parcelDeckRequest,
  resolveParcelDeckConfig,
} from "./helpers.js";

const shipmentStatus = Type.Union([
  Type.Literal("pending"),
  Type.Literal("label_created"),
  Type.Literal("in_transit"),
  Type.Literal("out_for_delivery"),
  Type.Literal("delivered"),
  Type.Literal("exception"),
  Type.Literal("returned"),
  Type.Literal("unknown"),
]);

const shipmentSource = Type.Union([
  Type.Literal("openclaw_email"),
  Type.Literal("manual"),
  Type.Literal("import"),
]);

export default definePluginEntry({
  id: "parcel-deck",
  name: "Parcel Deck",
  description: "Adds Parcel Deck shipment ingest and lookup tools to OpenClaw.",
  register(api) {
    if (api.registrationMode === "setup-runtime") {
      return;
    }

    const getConfig = () =>
      resolveParcelDeckConfig(api.pluginConfig as Record<string, unknown> | undefined);

    api.registerTool(
      {
        name: "parcel_deck_ingest_shipment",
        description:
          "Create or update a tracked shipment in Parcel Deck using metadata extracted from an email or order notice.",
        parameters: Type.Object(
          {
            carrier_hint: Type.Optional(Type.String()),
            current_status: Type.Optional(shipmentStatus),
            estimated_delivery: Type.Optional(
              Type.String({ description: "ISO-8601 datetime" }),
            ),
            external_id: Type.Optional(Type.String()),
            item_summary: Type.Optional(Type.String()),
            merchant: Type.Optional(Type.String()),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
            order_number: Type.Optional(Type.String()),
            ordered_at: Type.Optional(Type.String({ description: "ISO-8601 datetime" })),
            raw_email_excerpt: Type.Optional(Type.String()),
            source: Type.Optional(shipmentSource),
            source_message_id: Type.Optional(Type.String()),
            tracking_number: Type.Optional(Type.String()),
            tracking_url: Type.Optional(Type.String({ format: "uri" })),
          },
          { additionalProperties: false },
        ),
        async execute(_id, params) {
          const config = getConfig();
          const payload = {
            source: params.source ?? config.defaultSource,
            ...params,
          };

          api.logger.info("parcel_deck_ingest_shipment", {
            merchant: payload.merchant,
            tracking_number: payload.tracking_number,
          });

          const result = await parcelDeckRequest(config, "/api/ingest/shipments", {
            body: JSON.stringify(payload),
            method: "POST",
          });

          return {
            content: [
              {
                type: "text",
                text: formatToolResult("parcel_deck_ingest_shipment", result),
              },
            ],
          };
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "parcel_deck_list_shipments",
        description:
          "List shipments from Parcel Deck, optionally filtered by active state, status, or a text query.",
        parameters: Type.Object(
          {
            active: Type.Optional(Type.Boolean()),
            q: Type.Optional(Type.String()),
            status: Type.Optional(
              Type.Union([Type.Literal("all"), shipmentStatus]),
            ),
          },
          { additionalProperties: false },
        ),
        async execute(_id, params) {
          const result = await parcelDeckRequest(
            getConfig(),
            `/api/shipments${buildShipmentQuery(params)}`,
          );

          return {
            content: [
              {
                type: "text",
                text: formatToolResult("parcel_deck_list_shipments", result),
              },
            ],
          };
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "parcel_deck_get_shipment",
        description: "Fetch a single shipment record and event timeline from Parcel Deck.",
        parameters: Type.Object(
          {
            shipment_id: Type.String(),
          },
          { additionalProperties: false },
        ),
        async execute(_id, params) {
          const result = await parcelDeckRequest(
            getConfig(),
            `/api/shipments/${encodeURIComponent(params.shipment_id)}`,
          );

          return {
            content: [
              {
                type: "text",
                text: formatToolResult("parcel_deck_get_shipment", result),
              },
            ],
          };
        },
      },
      { optional: true },
    );
  },
});
