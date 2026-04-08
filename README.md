# Parcel Deck

Parcel Deck is a self-hosted dashboard for household shipments. It is designed to work with OpenClaw as the discovery layer: OpenClaw agents read shipping emails, then post normalized package metadata into this app through an authenticated ingest API.

## Stack

- Next.js 16 App Router
- Prisma + Postgres
- Docker Compose for `app`, `db`, and `worker`
- Free-first tracking approach with carrier deep links and an adapter seam for future aggregators

## Local setup

1. Copy `.env.example` to `.env` and set a long `INGEST_SHARED_SECRET`.
2. Start Postgres with Docker:

```bash
docker compose up -d db
```

3. Initialize the schema:

```bash
npm run db:push
```

4. Optional demo data:

```bash
npm run db:seed
```

5. Start the app:

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
- `worker`: periodic refresh worker for tracking-provider adapters

By default the full stack is exposed at [http://localhost:3010](http://localhost:3010), and Postgres is published on `5433`. Override those with `APP_PORT` and `POSTGRES_PORT` if you want different host ports.

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

## Read APIs

- `GET /api/shipments`
- `GET /api/shipments/:id`

Supported query params for `GET /api/shipments`:

- `status=in_transit`
- `active=true`
- `q=merchant or tracking query`

## Worker behavior

The worker currently refreshes active shipments on an interval and keeps carrier deep links bound. The provider seam is in place for a future aggregator-backed polling adapter when you decide a free tier or paid provider is worth adding.
