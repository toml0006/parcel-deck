import Link from "next/link";

import { ArrowUpRight, CalendarClock, Mail, Package, ScanSearch, Store } from "lucide-react";

import { formatCompactDate, formatRelative } from "@/lib/format";
import { getCarrierLabel } from "@/lib/shipments/carriers";
import type { DashboardShipment } from "@/lib/shipments/types";

import { StatusBadge } from "./status-badge";

const statusSurface = {
  delivered: "from-emerald-100 via-white/85 to-white/50",
  exception: "from-rose-100 via-white/85 to-white/50",
  in_transit: "from-cyan-100 via-white/85 to-white/50",
  label_created: "from-sky-100 via-white/85 to-white/50",
  out_for_delivery: "from-amber-100 via-white/85 to-white/50",
  pending: "from-slate-100 via-white/85 to-white/50",
  returned: "from-fuchsia-100 via-white/85 to-white/50",
  unknown: "from-stone-100 via-white/85 to-white/50",
} as const;

type ShipmentCardProps = {
  shipment: DashboardShipment;
};

export function ShipmentCard({ shipment }: ShipmentCardProps) {
  const latestEvent = shipment.events[0];
  const trackingArtifact = shipment.artifacts.find((artifact) => artifact.key === "tracking");
  const emailArtifact = shipment.artifacts.find((artifact) => artifact.key === "source-email");
  const surface = statusSurface[shipment.currentStatus];

  return (
    <article
      className={`rounded-[2rem] border border-white/60 bg-linear-to-br ${surface} p-6 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.42)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_32px_80px_-36px_rgba(15,23,42,0.5)]`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge status={shipment.currentStatus} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                {getCarrierLabel(shipment.carrier)}
              </p>
              <h3 className="mt-2 font-display text-3xl leading-tight text-slate-950">
                {shipment.itemSummary || shipment.merchant || "Untitled shipment"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {shipment.merchant ? `${shipment.merchant} · ` : ""}
                {shipment.orderNumber ? `Order ${shipment.orderNumber}` : "No order number"}
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-3 text-right shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Expected
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {formatCompactDate(shipment.estimatedDelivery)}
            </p>
          </div>
        </div>

        <dl className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              <Package className="size-4" />
              Tracking
            </dt>
            <dd className="mt-2 font-medium text-slate-950">
              {shipment.trackingNumber ?? "Not available yet"}
            </dd>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              <CalendarClock className="size-4" />
              Last event
            </dt>
            <dd className="mt-2 font-medium text-slate-950">
              {latestEvent?.description ?? "Waiting for the first event"}
            </dd>
            <dd className="mt-1 text-xs text-slate-500">
              {latestEvent ? formatRelative(latestEvent.occurredAt) : "No event yet"}
            </dd>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              <Store className="size-4" />
              Source
            </dt>
            <dd className="mt-2 font-medium text-slate-950">
              {shipment.source.replace(/_/g, " ")}
            </dd>
            <dd className="mt-1 text-xs text-slate-500">
              {shipment.sourceMessageId ?? "No source message id"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            href={`/shipments/${shipment.id}`}
          >
            <ScanSearch className="size-4" />
            Open detail
          </Link>
          {trackingArtifact?.url ? (
            <a
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
              href={trackingArtifact.url}
              rel="noreferrer"
              target="_blank"
            >
              <ArrowUpRight className="size-4" />
              Carrier link
            </a>
          ) : null}
          {emailArtifact?.url ? (
            <a
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
              href={emailArtifact.url}
              rel="noreferrer"
              target="_blank"
            >
              <Mail className="size-4" />
              Source email
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
