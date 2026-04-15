import { detectCarrierFromTrackingNumber } from "../carriers";
import { type CarrierScraper, type ScrapeResult, failure } from "./types";
import { upsScraper } from "./ups";
import { fedexScraper } from "./fedex";
import { uspsScraper } from "./usps";
import { amazonScraper } from "./amazon";
import { dhlScraper } from "./dhl";
import { ontracScraper, lasershipScraper } from "./ontrac";
import { yunexpressScraper } from "./yunexpress";
import { canadaPostScraper } from "./canadapost";
import { ubiquitiScraper } from "./ubiquiti";
import { sweetwaterScraper } from "./sweetwater";

const amazonOrdersScraper: CarrierScraper = async (input) => {
  // Only defer to the amazon scraper for progress-tracker URLs or
  // track.amazon.com URLs — the amazon scraper cannot parse the
  // gp/your-account/order-details page that ingest writes by default.
  if (
    input.trackingUrl &&
    /(amazon\.com\/progress-tracker|track\.amazon\.com)/i.test(input.trackingUrl)
  ) {
    return amazonScraper(input);
  }
  return {
    ok: true,
    carrier: "amazon_orders",
    status: "awaiting_carrier" as never,
    estimatedDelivery: null,
    deliveredAt: null,
    events: [],
  };
};

const registry: Record<string, CarrierScraper | undefined> = {
  ups: upsScraper,
  fedex: fedexScraper,
  usps: uspsScraper,
  amazon_logistics: amazonScraper,
  amazon_orders: amazonOrdersScraper,
  dhl: dhlScraper,
  ontrac: ontracScraper,
  lasership: lasershipScraper,
  yunexpress: yunexpressScraper,
  canada_post: canadaPostScraper,
  ubiquiti: ubiquitiScraper,
  sweetwater: sweetwaterScraper,
};

const merchantFallback: Record<string, CarrierScraper | undefined> = {
  sweetwater: sweetwaterScraper,
  ubiquiti: ubiquitiScraper,
  "ubiquiti store": ubiquitiScraper,
};

/**
 * Scrapers that can run without a tracking number because they resolve via
 * trackingUrl / orderNumber instead.
 */
const URL_DRIVEN = new Set([
  "amazon_logistics",
  "amazon_orders",
  "ubiquiti",
  "sweetwater",
]);

export async function scrapeCarrier(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
  context: { trackingUrl?: string | null; merchant?: string | null; orderNumber?: string | null } = {},
): Promise<ScrapeResult> {
  const input = {
    carrier: carrier ?? "",
    trackingNumber: trackingNumber ?? "",
    trackingUrl: context.trackingUrl ?? null,
    merchant: context.merchant ?? null,
    orderNumber: context.orderNumber ?? null,
  };

  const effectiveCarrier = carrier ?? detectCarrierFromTrackingNumber(trackingNumber);

  if (effectiveCarrier) {
    const scraper = registry[effectiveCarrier];
    if (!scraper) return failure(`No scraper for carrier: ${effectiveCarrier}`, false);
    if (!trackingNumber && !URL_DRIVEN.has(effectiveCarrier)) {
      return failure("No tracking number", false);
    }
    input.carrier = effectiveCarrier;
    const result = await scraper(input);
    if (result.ok && !carrier) {
      // Ensure the resolved carrier is persisted up the stack.
      result.carrier = effectiveCarrier;
    }
    return result;
  }

  // No carrier set: try a merchant-based fallback.
  const merchantKey = context.merchant?.trim().toLowerCase();
  if (merchantKey) {
    const merchantScraper = merchantFallback[merchantKey];
    if (merchantScraper) return merchantScraper(input);
    for (const [key, scraper] of Object.entries(merchantFallback)) {
      if (scraper && merchantKey.includes(key)) return scraper(input);
    }
  }

  return failure("No carrier set", false);
}

export type { ScrapeResult } from "./types";
