import { ShipmentStatus } from "@prisma/client";

export const shipmentStatusOptions = [
  ShipmentStatus.in_transit,
  ShipmentStatus.out_for_delivery,
  ShipmentStatus.exception,
  ShipmentStatus.delivered,
  ShipmentStatus.label_created,
  ShipmentStatus.pending,
  ShipmentStatus.awaiting_carrier,
  ShipmentStatus.returned,
  ShipmentStatus.unknown,
] as const;

type StatusMeta = {
  label: string;
  eyebrow: string;
  tone: string;
  rank: number;
};

export const shipmentStatusMeta: Record<ShipmentStatus, StatusMeta> = {
  [ShipmentStatus.pending]: {
    label: "Pending",
    eyebrow: "Queued",
    tone: "ring-slate-300/90 bg-white/70 text-slate-900",
    rank: 5,
  },
  [ShipmentStatus.label_created]: {
    label: "Label created",
    eyebrow: "Pre-transit",
    tone: "ring-sky-300/90 bg-sky-100/80 text-sky-950",
    rank: 4,
  },
  [ShipmentStatus.in_transit]: {
    label: "In transit",
    eyebrow: "Moving",
    tone: "ring-cyan-300/90 bg-cyan-100/80 text-cyan-950",
    rank: 3,
  },
  [ShipmentStatus.out_for_delivery]: {
    label: "Out for delivery",
    eyebrow: "Today",
    tone: "ring-amber-300/90 bg-amber-100/80 text-amber-950",
    rank: 1,
  },
  [ShipmentStatus.delivered]: {
    label: "Delivered",
    eyebrow: "Arrived",
    tone: "ring-emerald-300/90 bg-emerald-100/80 text-emerald-950",
    rank: 6,
  },
  [ShipmentStatus.exception]: {
    label: "Exception",
    eyebrow: "Needs attention",
    tone: "ring-rose-300/90 bg-rose-100/80 text-rose-950",
    rank: 0,
  },
  [ShipmentStatus.returned]: {
    label: "Returned",
    eyebrow: "Backtrack",
    tone: "ring-fuchsia-300/90 bg-fuchsia-100/80 text-fuchsia-950",
    rank: 7,
  },
  [ShipmentStatus.awaiting_carrier]: {
    label: "Awaiting carrier",
    eyebrow: "No tracking yet",
    tone: "ring-violet-300/90 bg-violet-100/80 text-violet-950",
    rank: 5,
  },
  [ShipmentStatus.unknown]: {
    label: "Unknown",
    eyebrow: "Unclear",
    tone: "ring-stone-300/90 bg-stone-100/80 text-stone-900",
    rank: 9,
  },
};

const statusAliasMap: Record<string, ShipmentStatus> = {
  awaitingcarrier: ShipmentStatus.awaiting_carrier,
  awaiting_carrier: ShipmentStatus.awaiting_carrier,
  created: ShipmentStatus.label_created,
  delivered: ShipmentStatus.delivered,
  delivery: ShipmentStatus.delivered,
  delayed: ShipmentStatus.exception,
  exception: ShipmentStatus.exception,
  failed: ShipmentStatus.exception,
  intransit: ShipmentStatus.in_transit,
  in_transit: ShipmentStatus.in_transit,
  moving: ShipmentStatus.in_transit,
  ontheway: ShipmentStatus.in_transit,
  outfordelivery: ShipmentStatus.out_for_delivery,
  out_for_delivery: ShipmentStatus.out_for_delivery,
  pending: ShipmentStatus.pending,
  pretransit: ShipmentStatus.label_created,
  pre_transit: ShipmentStatus.label_created,
  ready: ShipmentStatus.pending,
  returned: ShipmentStatus.returned,
  shipped: ShipmentStatus.in_transit,
  transit: ShipmentStatus.in_transit,
  unknown: ShipmentStatus.unknown,
};

const statusPhraseMatchers: Array<{
  match: RegExp;
  status: ShipmentStatus;
}> = [
  {
    match: /(delivery exception|failed delivery|delay|exception)/,
    status: ShipmentStatus.exception,
  },
  {
    match: /(out for delivery|arriving today)/,
    status: ShipmentStatus.out_for_delivery,
  },
  {
    match: /(in transit|shipped|on the way)/,
    status: ShipmentStatus.in_transit,
  },
  {
    match: /(pre-transit|label created)/,
    status: ShipmentStatus.label_created,
  },
  {
    match: /delivered/,
    status: ShipmentStatus.delivered,
  },
  {
    match: /returned/,
    status: ShipmentStatus.returned,
  },
];

export function normalizeShipmentStatus(
  value?: string | ShipmentStatus | null,
): ShipmentStatus {
  if (!value) {
    return ShipmentStatus.unknown;
  }

  if (Object.values(ShipmentStatus).includes(value as ShipmentStatus)) {
    return value as ShipmentStatus;
  }

  const raw = value.toString().trim().toLowerCase();
  const normalized = raw.replace(/[^a-z]+/g, "");

  if (statusAliasMap[normalized]) {
    return statusAliasMap[normalized];
  }

  const phraseMatch = statusPhraseMatchers.find((matcher) => matcher.match.test(raw));

  return phraseMatch?.status ?? ShipmentStatus.unknown;
}

export function isActiveShipmentStatus(status: ShipmentStatus) {
  return status !== ShipmentStatus.delivered && status !== ShipmentStatus.returned;
}

export function getShipmentStatusMeta(status: ShipmentStatus) {
  return shipmentStatusMeta[status];
}

export function getShipmentStatusRank(status: ShipmentStatus) {
  return shipmentStatusMeta[status].rank;
}
