import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { formatCompactDate, formatRelative } from "@/lib/format";
import { getCarrierLabel } from "@/lib/shipments/carriers";
import { getShipmentStatusMeta } from "@/lib/shipments/status";
import type { DashboardShipment } from "@/lib/shipments/types";

const dotColor: Record<string, string> = {
  delivered: "bg-emerald-500",
  exception: "bg-rose-500",
  in_transit: "bg-cyan-500",
  label_created: "bg-sky-500",
  out_for_delivery: "bg-amber-500",
  pending: "bg-slate-400",
  returned: "bg-fuchsia-500",
  awaiting_carrier: "bg-violet-500",
  unknown: "bg-stone-400",
};

export function PriorityCard({ shipment }: { shipment: DashboardShipment }) {
  const meta = getShipmentStatusMeta(shipment.currentStatus);
  const latest = shipment.events[0];
  const trackingArtifact = shipment.artifacts.find((a) => a.key === "tracking");

  return (
    <article className="group relative flex min-w-[260px] flex-shrink-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
          <span
            className={`size-2 rounded-full ${dotColor[shipment.currentStatus] ?? "bg-slate-400"}`}
          />
          {meta.label}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {getCarrierLabel(shipment.carrier)}
        </span>
      </div>
      <Link href={`/shipments/${shipment.id}`} className="block">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-950 group-hover:text-slate-800">
          {shipment.itemSummary || shipment.merchant || "Untitled shipment"}
        </h3>
        {shipment.merchant && shipment.itemSummary ? (
          <p className="mt-1 truncate text-xs text-slate-500">{shipment.merchant}</p>
        ) : null}
      </Link>
      <div className="flex items-end justify-between gap-2 pt-1">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">ETA</p>
          <p className="truncate text-sm font-medium text-slate-900">
            {formatCompactDate(shipment.estimatedDelivery)}
          </p>
          {latest ? (
            <p className="mt-1 truncate text-xs text-slate-500">
              {formatRelative(latest.occurredAt)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {trackingArtifact?.url ? (
            <a
              href={trackingArtifact.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Carrier page"
            >
              <ArrowUpRight className="size-4" />
            </a>
          ) : null}
          <Link
            href={`/shipments/${shipment.id}`}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
