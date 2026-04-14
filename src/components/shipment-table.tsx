"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Mail } from "lucide-react";

import { formatCompactDate, formatRelative } from "@/lib/format";
import { getCarrierLabel } from "@/lib/shipments/carriers";
import {
  getShipmentStatusMeta,
  getShipmentStatusRank,
} from "@/lib/shipments/status";

type TableShipment = {
  id: string;
  currentStatus: string;
  merchant: string | null;
  itemSummary: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  lastEventAt: string | null;
  lastEventDescription: string | null;
  createdAt: string;
  trackingUrl: string | null;
  sourceEmailUrl: string | null;
};

type SortKey = "status" | "merchant" | "carrier" | "eta" | "lastEvent" | "age";
type SortDir = "asc" | "desc";

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

function toTime(value: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const t = new Date(value).getTime();
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

export function ShipmentTable({ shipments }: { shipments: TableShipment[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "status",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const arr = [...shipments];
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.key) {
        case "status": {
          const aR = getShipmentStatusRank(a.currentStatus as never);
          const bR = getShipmentStatusRank(b.currentStatus as never);
          if (aR !== bR) return dir * (aR - bR);
          return dir * (toTime(a.estimatedDelivery) - toTime(b.estimatedDelivery));
        }
        case "merchant":
          return dir * ((a.merchant ?? "").localeCompare(b.merchant ?? ""));
        case "carrier":
          return dir * ((a.carrier ?? "").localeCompare(b.carrier ?? ""));
        case "eta":
          return dir * (toTime(a.estimatedDelivery) - toTime(b.estimatedDelivery));
        case "lastEvent":
          return dir * (toTime(b.lastEventAt) - toTime(a.lastEventAt));
        case "age":
          return dir * (toTime(b.createdAt) - toTime(a.createdAt));
      }
    });
    return arr;
  }, [shipments, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function Th({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = sort.key === sortKey;
    return (
      <th className="sticky top-0 z-10 bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className="inline-flex items-center gap-1 transition hover:text-slate-900"
        >
          {label}
          {active ? (
            sort.dir === "asc" ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )
          ) : (
            <span className="size-3" />
          )}
        </button>
      </th>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">
        No packages match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <Th label="Status" sortKey="status" />
              <Th label="Merchant" sortKey="merchant" />
              <th className="sticky top-0 z-10 bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Item
              </th>
              <Th label="Carrier" sortKey="carrier" />
              <th className="sticky top-0 z-10 bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Tracking
              </th>
              <Th label="ETA" sortKey="eta" />
              <Th label="Last event" sortKey="lastEvent" />
              <Th label="Age" sortKey="age" />
              <th className="sticky top-0 z-10 bg-white px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const meta = getShipmentStatusMeta(s.currentStatus as never);
              return (
                <tr
                  key={s.id}
                  className="group border-b border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5 align-top">
                    <Link
                      href={`/shipments/${s.id}`}
                      className="inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <span
                        className={`size-2 rounded-full ${dotColor[s.currentStatus] ?? "bg-slate-400"}`}
                      />
                      <span className="text-xs font-medium text-slate-700">
                        {meta.label}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Link
                      href={`/shipments/${s.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-slate-600"
                    >
                      {s.merchant ?? "—"}
                    </Link>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5 align-top">
                    <Link
                      href={`/shipments/${s.id}`}
                      className="block truncate text-sm text-slate-700 hover:text-slate-950"
                      title={s.itemSummary ?? ""}
                    >
                      {s.itemSummary ?? "—"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-slate-600">
                    {getCarrierLabel(s.carrier)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {s.trackingNumber ? (
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                        {s.trackingNumber}
                      </code>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-slate-700">
                    {s.estimatedDelivery ? formatCompactDate(s.estimatedDelivery) : "—"}
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5 align-top">
                    <p className="truncate text-xs text-slate-700" title={s.lastEventDescription ?? ""}>
                      {s.lastEventDescription ?? "—"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {s.lastEventAt ? formatRelative(s.lastEventAt) : ""}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-slate-500">
                    {formatRelative(s.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top">
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      {s.trackingUrl ? (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                          title="Carrier link"
                        >
                          <ArrowUpRight className="size-4" />
                        </a>
                      ) : null}
                      {s.sourceEmailUrl ? (
                        <a
                          href={s.sourceEmailUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                          title="Source email"
                        >
                          <Mail className="size-4" />
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
