const carrierLabelMap: Record<string, string> = {
  amazon_logistics: "Amazon Logistics",
  amazon_orders: "Amazon",
  canada_post: "Canada Post",
  dhl: "DHL",
  fedex: "FedEx",
  lasership: "LaserShip",
  ontrac: "OnTrac",
  sweetwater: "Sweetwater",
  ubiquiti: "Ubiquiti",
  ups: "UPS",
  usps: "USPS",
  yunexpress: "YunExpress",
};

const AMAZON_ORDER_ID_RE = /^\d{3}-\d{7}-\d{7}$/;

export function isAmazonOrderId(value?: string | null) {
  if (!value) return false;
  return AMAZON_ORDER_ID_RE.test(value.trim());
}

export function normalizeTrackingNumber(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return normalized || null;
}

export function normalizeCarrierHint(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.includes("amazon")) {
    return "amazon_logistics";
  }

  if (normalized.includes("fedex")) {
    return "fedex";
  }

  if (normalized.includes("usps") || normalized.includes("postal")) {
    return "usps";
  }

  if (normalized.includes("ups")) {
    return "ups";
  }

  if (normalized.includes("ontrac")) {
    return "ontrac";
  }

  if (normalized.includes("laser")) {
    return "lasership";
  }

  if (normalized.includes("dhl")) {
    return "dhl";
  }

  if (
    normalized.includes("yunexpress") ||
    normalized.includes("yuntrack") ||
    normalized.includes("yun express") ||
    normalized.includes("yun track")
  ) {
    return "yunexpress";
  }

  if (normalized.includes("canada post") || normalized.includes("canadapost")) {
    return "canada_post";
  }

  if (normalized.includes("sweetwater")) {
    return "sweetwater";
  }

  if (normalized.includes("ubiquiti") || normalized.includes("ui.com")) {
    return "ubiquiti";
  }

  return normalized.replace(/[^a-z0-9]+/g, "_");
}

/**
 * Detect a carrier from the shape of a tracking number when no hint is given.
 * Returns null when no pattern matches — callers should fall back to merchant
 * heuristics or leave carrier unset.
 */
export function detectCarrierFromTrackingNumber(
  value?: string | null,
): string | null {
  const normalized = normalizeTrackingNumber(value);
  if (!normalized) return null;

  // Canada Post: LA/LB/RA etc. + 9 digits + CA.
  if (/^[A-Z]{2}\d{9}CA$/.test(normalized)) return "canada_post";

  // YunExpress: YT + digits.
  if (/^YT\d{10,}$/.test(normalized)) return "yunexpress";

  // USPS: 20 or 22 digit IMpb starting with 92/93/94/95, or 13-char
  // international / priority-mail label (2 letters + 9 digits + US).
  if (/^(92|93|94|95)\d{18}$/.test(normalized)) return "usps";
  if (/^(92|93|94|95)\d{20}$/.test(normalized)) return "usps";
  if (/^420\d{5}(92|93|94|95)\d{18,22}$/.test(normalized)) return "usps";
  if (/^[A-Z]{2}\d{9}US$/.test(normalized)) return "usps";

  // UPS: 1Z + 16 alphanum.
  if (/^1Z[A-Z0-9]{16}$/.test(normalized)) return "ups";

  // FedEx: 12 or 15 digits. Kept narrow so it doesn't steal 22-digit USPS.
  if (/^\d{12}$/.test(normalized) || /^\d{15}$/.test(normalized)) return "fedex";

  return null;
}

export function getCarrierLabel(value?: string | null) {
  if (!value) {
    return "Unknown carrier";
  }

  const key = normalizeCarrierHint(value);

  if (key && carrierLabelMap[key]) {
    return carrierLabelMap[key];
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

export function buildTrackingUrl(carrier?: string | null, trackingNumber?: string | null) {
  const normalizedCarrier = normalizeCarrierHint(carrier);
  const normalizedTrackingNumber = normalizeTrackingNumber(trackingNumber);

  if (!normalizedCarrier || !normalizedTrackingNumber) {
    return null;
  }

  const encoded = encodeURIComponent(normalizedTrackingNumber);

  switch (normalizedCarrier) {
    case "ups":
      return `https://www.ups.com/track?tracknum=${encoded}`;
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
    case "dhl":
      return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encoded}`;
    case "ontrac":
      return `https://www.ontrac.com/trackingresults.asp?tracking_number=${encoded}`;
    case "lasership":
      return `https://www.lasership.com/track/${encoded}/detail`;
    case "amazon_logistics":
      return `https://track.amazon.com/tracking/${encoded}`;
    case "amazon_orders":
      return `https://www.amazon.com/gp/your-account/order-details?orderID=${encoded}`;
    case "canada_post":
      return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${encoded}`;
    case "yunexpress":
      return `https://www.yuntrack.com/parcelTracking?id=${encoded}`;
    default:
      return null;
  }
}
