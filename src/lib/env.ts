const defaultWorkerIntervalMs = 5 * 60 * 1000;

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  ingestSharedSecret: process.env.INGEST_SHARED_SECRET ?? "",
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? defaultWorkerIntervalMs),
  trackingProvider: process.env.TRACKING_PROVIDER === "aggregator" ? "aggregator" : "carrier_link",
  trackingProviderApiKey: process.env.TRACKING_PROVIDER_API_KEY ?? "",
};
