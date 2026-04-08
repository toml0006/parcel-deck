# Parcel Deck OpenClaw Plugin

This native OpenClaw plugin exposes Parcel Deck as three optional agent tools:

- `parcel_deck_ingest_shipment`
- `parcel_deck_list_shipments`
- `parcel_deck_get_shipment`

## Install

From the root of this repo:

```bash
openclaw plugins install ./openclaw-plugin
openclaw gateway restart
```

## Configure

Add the plugin entry to `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      "parcel-deck": {
        enabled: true,
        config: {
          baseUrl: "http://localhost:3010",
          sharedSecret: "replace-with-a-long-random-secret",
          defaultSource: "openclaw_email",
          timeoutMs: 15000
        }
      }
    }
  }
}
```

You can also provide these as environment variables:

- `PARCEL_DECK_URL`
- `PARCEL_DECK_SHARED_SECRET`
- `PARCEL_DECK_DEFAULT_SOURCE`
- `PARCEL_DECK_TIMEOUT_MS`

## Allow the tools

Because the tools are registered as optional, add either the plugin id or the tool names to your OpenClaw allowlist:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: ["parcel-deck"]
        }
      }
    ]
  }
}
```

Or enable only the ingest tool:

```json5
{
  tools: {
    allow: ["parcel_deck_ingest_shipment"]
  }
}
```

## Example usage

Once enabled, an OpenClaw email workflow can call:

```json
{
  "merchant": "Tracksmith",
  "carrier_hint": "UPS",
  "tracking_number": "1ZTRACKSMITH2049",
  "order_number": "TS-2049",
  "item_summary": "Twilight running vest",
  "estimated_delivery": "2026-04-11T18:00:00.000Z",
  "source_message_id": "mail-ts-2049"
}
```
