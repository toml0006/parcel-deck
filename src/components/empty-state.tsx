export function EmptyState() {
  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/75 p-7 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.4)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
        No active shipments
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-950">
        The board is ready for OpenClaw ingest.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        Send tracked shipments into the dashboard by posting shipping-email metadata to the ingest
        API. Once a package lands here, the app keeps it in the in-transit board with the latest
        ETA, provenance, tracking links, and event history.
      </p>
      <pre className="mt-5 overflow-x-auto rounded-[1.5rem] bg-slate-950 p-5 text-sm leading-7 text-slate-100">
        <code>{`curl -X POST http://localhost:3000/api/ingest/shipments \\
  -H "Authorization: Bearer $INGEST_SHARED_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "openclaw_email",
    "merchant": "Huckberry",
    "carrier_hint": "UPS",
    "tracking_number": "1Z12345E0205271688",
    "order_number": "HB-2048",
    "item_summary": "Waxed trucker jacket",
    "estimated_delivery": "2026-04-09T19:00:00.000Z"
  }'`}</code>
      </pre>
    </section>
  );
}
