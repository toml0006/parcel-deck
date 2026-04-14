import { type CarrierScraper, type ScrapeResult, failure } from "./types";
import { upsScraper } from "./ups";
import { fedexScraper } from "./fedex";
import { uspsScraper } from "./usps";
import { amazonScraper } from "./amazon";
import { dhlScraper } from "./dhl";
import { ontracScraper, lasershipScraper } from "./ontrac";

const amazonOrdersScraper: CarrierScraper = async () => ({
  ok: true,
  carrier: "amazon_orders",
  // awaiting_carrier is set at ingest; we return unknown here and let the
  // caller preserve existing status.
  status: "awaiting_carrier" as never,
  estimatedDelivery: null,
  deliveredAt: null,
  events: [],
});

const registry: Record<string, CarrierScraper | undefined> = {
  ups: upsScraper,
  fedex: fedexScraper,
  usps: uspsScraper,
  amazon_logistics: amazonScraper,
  amazon_orders: amazonOrdersScraper,
  dhl: dhlScraper,
  ontrac: ontracScraper,
  lasership: lasershipScraper,
};

export async function scrapeCarrier(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): Promise<ScrapeResult> {
  if (!carrier) return failure("No carrier set", false);
  const scraper = registry[carrier];
  if (!scraper) return failure(`No scraper for carrier: ${carrier}`, false);
  if (carrier !== "amazon_orders" && !trackingNumber) {
    return failure("No tracking number", false);
  }
  return scraper({ carrier, trackingNumber: trackingNumber ?? "" });
}

export type { ScrapeResult } from "./types";
