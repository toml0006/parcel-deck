const carrierLabelMap: Record<string, string> = {
  amazon_logistics: "Amazon Logistics",
  amazon_orders: "Amazon",
  dhl: "DHL",
  fedex: "FedEx",
  lasership: "LaserShip",
  ontrac: "OnTrac",
  ups: "UPS",
  usps: "USPS",
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

  return normalized.replace(/[^a-z0-9]+/g, "_");
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
    default:
      return null;
  }
}
