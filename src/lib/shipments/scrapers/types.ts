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
  trackingUrl?: string | null;
  merchant?: string | null;
  orderNumber?: string | null;
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

/**
 * Strict host-allowlist check for scraper URLs sourced from the DB.
 * Ingest validates `tracking_url` as a syntactic URL only; here we refuse to
 * fetch anything outside the expected carrier/merchant hostnames.
 */
export function isAllowedUrl(raw: string | null | undefined, allowedHosts: string[]): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return allowedHosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}
