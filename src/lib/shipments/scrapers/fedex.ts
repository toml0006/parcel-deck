import { ShipmentStatus } from "@prisma/client";

import { normalizeShipmentStatus } from "../status";
import {
  type CarrierScraper,
  type ScrapedEvent,
  USER_AGENT,
  failure,
  stableDedupeKey,
} from "./types";

const ENDPOINT = "https://www.fedex.com/trackingCal/track";

type FedexPackage = {
  keyStatus?: string;
  statusWithDetails?: string;
  displayEstDeliveryDateTime?: string;
  displayActDeliveryDateTime?: string;
  actDeliveryDt?: string;
  estDeliveryDt?: string;
  scanEventList?: Array<{
    date?: string;
    time?: string;
    gmtOffset?: string;
    scanLocation?: string;
    status?: string;
  }>;
};

function parseDateTime(date?: string, time?: string, tz?: string): Date | null {
  if (!date) return null;
  const t = time || "00:00:00";
  const z = tz || "";
  const iso = `${date}T${t}${z}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export const fedexScraper: CarrierScraper = async ({ trackingNumber }) => {
  try {
    const body = new URLSearchParams();
    body.set(
      "data",
      JSON.stringify({
        TrackPackagesRequest: {
          appType: "WTRK",
          uniqueKey: "",
          processingParameters: {},
          trackingInfoList: [
            {
              trackNumberInfo: {
                trackingNumber,
                trackingQualifier: "",
                trackingCarrier: "",
              },
            },
          ],
        },
      }),
    );
    body.set("action", "trackpackages");
    body.set("locale", "en_US");
    body.set("version", "1");
    body.set("format", "json");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://www.fedex.com",
        Referer: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      },
      body: body.toString(),
    });
    if (!res.ok) return failure(`FedEx HTTP ${res.status}`, res.status >= 500);

    const json = (await res.json()) as {
      TrackPackagesResponse?: { packageList?: FedexPackage[] };
    };
    const pkg = json.TrackPackagesResponse?.packageList?.[0];
    if (!pkg) return failure("FedEx no package", true);

    const status = normalizeShipmentStatus(pkg.keyStatus || pkg.statusWithDetails || "");
    const estimatedDelivery = parseDateTime(pkg.estDeliveryDt);
    const deliveredAt =
      status === ShipmentStatus.delivered
        ? parseDateTime(pkg.actDeliveryDt) ?? new Date()
        : null;

    const events: ScrapedEvent[] = (pkg.scanEventList ?? [])
      .map((s): ScrapedEvent | null => {
        const occurredAt = parseDateTime(s.date, s.time, s.gmtOffset);
        if (!occurredAt) return null;
        const description = s.status || "Update";
        return {
          occurredAt,
          status: normalizeShipmentStatus(s.status || ""),
          description,
          location: s.scanLocation ?? null,
          dedupeKey: stableDedupeKey(["fedex", occurredAt.toISOString(), description]),
        } satisfies ScrapedEvent;
      })
      .filter((x): x is ScrapedEvent => x !== null)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return { ok: true, carrier: "fedex", status, estimatedDelivery, deliveredAt, events };
  } catch (error) {
    return failure(`FedEx scrape error: ${(error as Error).message}`, true);
  }
};
