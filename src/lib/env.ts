const defaultWorkerIntervalMs = 5 * 60 * 1000;

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  easyPostApiKey: process.env.EASYPOST_API_KEY ?? "",
  easyPostWebhookSecret: process.env.EASYPOST_WEBHOOK_SECRET ?? "",
  ingestSharedSecret: process.env.INGEST_SHARED_SECRET ?? "",
  liveRefreshIntervalMs: Number(process.env.LIVE_REFRESH_INTERVAL_MS ?? 3000),
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? defaultWorkerIntervalMs),
  trackingProvider:
    process.env.TRACKING_PROVIDER === "easypost"
      ? "easypost"
      : process.env.TRACKING_PROVIDER === "carrier_link"
        ? "carrier_link"
        : "scraper",
};
