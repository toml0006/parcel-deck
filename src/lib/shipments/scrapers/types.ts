import type { ShipmentStatus } from "@prisma/client";

export type ScrapedEvent = {
  occurredAt: Date;
  status: ShipmentStatus;
  description: string;
  location?: string | null;
  dedupeKey: string;
};

export type ScrapeSuccess = {
  ok: true;
  carrier: string;
  status: ShipmentStatus;
  estimatedDelivery?: Date | null;
  deliveredAt?: Date | null;
  events: ScrapedEvent[];
  raw?: unknown;
};

export type ScrapeFailure = {
  ok: false;
  transient: boolean;
  error: string;
};

export type ScrapeResult = ScrapeSuccess | ScrapeFailure;

export type ScrapeInput = {
  carrier: string;
  trackingNumber: string;
};

export type CarrierScraper = (input: ScrapeInput) => Promise<ScrapeResult>;

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function failure(error: string, transient = true): ScrapeFailure {
  return { ok: false, transient, error };
}

export function stableDedupeKey(parts: Array<string | number | null | undefined>) {
  return parts.filter((v) => v !== null && v !== undefined).join("|");
}
