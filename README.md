# Parcel Deck

Parcel Deck is a self-hosted dashboard for household shipments. It is designed to work with OpenClaw as the discovery layer: OpenClaw agents read shipping emails, then post normalized package metadata into this app through an authenticated ingest API.

OpenClaw is only the discovery layer. Parcel Deck is the tracking system of record. Once a shipment is ingested, Parcel Deck owns tracker registration, webhook handling, polling fallback, event history, and live UI refresh.

## Stack

- Next.js 16 App Router
- Prisma + Postgres
- Docker Compose for `app`, `db`, and `worker`
- Prisma + Postgres
- Optional EasyPost-backed live tracking with webhooks and polling fallback
- Server-Sent Events for live dashboard/detail refresh

## Local setup

1. Copy `.env.example` to `.env` and set a long `INGEST_SHARED_SECRET`.
2. Optional for app-owned live tracking: set `TRACKING_PROVIDER=easypost`, `EASYPOST_API_KEY`, and `EASYPOST_WEBHOOK_SECRET`.
3. Start Postgres with Docker:

```bash
docker compose up -d db
```

4. Initialize the schema:

```bash
npm run db:push
```

5. Optional demo data:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

The dashboard runs at [http://localhost:3000](http://localhost:3000).
The compose-managed database is exposed on `5433` by default to avoid colliding with an existing local Postgres instance.

## Full self-hosted stack

```bash
docker compose up --build
```

This brings up:

- `db`: Postgres 16
- `app`: Next.js server
- `worker`: polling fallback and provider refresh loop

By default the full stack is exposed at [http://localhost:3010](http://localhost:3010), and Postgres is published on `5433`. Override those with `APP_PORT` and `POSTGRES_PORT` if you want different host ports.

To enable app-owned live tracking in Docker:

```bash
TRACKING_PROVIDER=easypost \
EASYPOST_API_KEY=your_api_key \
EASYPOST_WEBHOOK_SECRET=your_webhook_secret \
docker compose up --build
```

## Ingest API

OpenClaw agents should post discovered shipments to:

```text
POST /api/ingest/shipments
```

Authentication:

- `Authorization: Bearer <INGEST_SHARED_SECRET>`
- or `x-ingest-token: <INGEST_SHARED_SECRET>`

Minimal example:

```bash
curl -X POST http://localhost:3000/api/ingest/shipments \
  -H "Authorization: Bearer $INGEST_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "openclaw_email",
    "merchant": "Huckberry",
    "carrier_hint": "UPS",
    "tracking_number": "1Z12345E0205271688",
    "order_number": "HB-2048",
    "item_summary": "Waxed trucker jacket",
    "estimated_delivery": "2026-04-09T19:00:00.000Z",
    "metadata": {
      "email_permalink": "https://mail.example/thread/123"
    }
  }'
```

The endpoint deduplicates repeated ingests using source checksum, source message id, and carrier + tracking number when available.

## App-owned tracking

When `TRACKING_PROVIDER=easypost` and `EASYPOST_API_KEY` is set, Parcel Deck creates or reuses an EasyPost tracker for each shipment after ingest. From that point forward, tracking updates belong to the app:

- Parcel Deck registers the tracker
- Parcel Deck receives webhook updates at `POST /api/tracking/webhooks/easypost`
- Parcel Deck polls EasyPost from the worker as a fallback
- Parcel Deck updates the shipment timeline and status history in Postgres
- Parcel Deck pushes live UI refresh through `GET /api/shipments/live`

### EasyPost webhook setup

Configure an EasyPost webhook to send events to:

```text
https://your-public-parcel-deck-host/api/tracking/webhooks/easypost
```

Use a custom outbound header in EasyPost:

```text
X-Parcel-Deck-Webhook-Token: <EASYPOST_WEBHOOK_SECRET>
```

Parcel Deck validates that header before applying the webhook.

EasyPost test tracking codes are useful for validating end-to-end flows once your webhook is reachable. Their official tracker docs include canned codes such as:

- `EZ2000000002` for `in_transit`
- `EZ3000000003` for `out_for_delivery`
- `EZ4000000004` for `delivered`
- `EZ6000000006` for `failure`

Source: EasyPost Tracker API docs and Webhooks Guide:

- https://docs.easypost.com/docs/trackers
- https://docs.easypost.com/guides/webhooks-guide

## OpenClaw plugin

This repo now includes a native OpenClaw plugin in [openclaw-plugin/README.md](/Users/jackson/dev/middleout/package-tracker/openclaw-plugin/README.md). It exposes Parcel Deck as optional OpenClaw tools so your agents can call the dashboard directly instead of manually constructing HTTP requests.

Install it from this repo:

```bash
openclaw plugins install ./openclaw-plugin
openclaw gateway restart
```

Then add plugin config to `~/.openclaw/openclaw.json`:

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

Because the plugin tools are optional, allow them explicitly:

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

## Read APIs

- `GET /api/shipments`
- `GET /api/shipments/:id`
- `GET /api/shipments/live` for SSE-based live refresh

Supported query params for `GET /api/shipments`:

- `status=in_transit`
- `active=true`
- `q=merchant or tracking query`

## Worker behavior

The worker refreshes active shipments on an interval. With `TRACKING_PROVIDER=easypost`, it retrieves tracker state directly from EasyPost as a fallback in case webhook delivery is delayed or unavailable. Without EasyPost configured, it falls back to carrier deep links only.
