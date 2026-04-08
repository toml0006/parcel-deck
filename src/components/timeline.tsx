import { formatDateTime } from "@/lib/format";
import type { ShipmentDetail } from "@/lib/shipments/types";

import { StatusBadge } from "./status-badge";

type TimelineProps = {
  shipment: ShipmentDetail;
};

export function Timeline({ shipment }: TimelineProps) {
  return (
    <ol className="space-y-4">
      {shipment.events.map((event) => (
        <li
          key={event.id}
          className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <StatusBadge status={event.status} />
              <div>
                <p className="text-lg font-semibold text-slate-950">{event.description}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {event.location ?? "Location unavailable"}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-600">{formatDateTime(event.occurredAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
