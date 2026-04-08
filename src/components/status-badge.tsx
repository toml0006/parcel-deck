import { type ShipmentStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

import { getShipmentStatusMeta } from "@/lib/shipments/status";

type StatusBadgeProps = {
  className?: string;
  status: ShipmentStatus;
};

export function StatusBadge({ className, status }: StatusBadgeProps) {
  const meta = getShipmentStatusMeta(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ring-1 ring-inset",
        meta.tone,
        className,
      )}
    >
      <span className="text-[0.7rem] text-current/70">{meta.eyebrow}</span>
      <span>{meta.label}</span>
    </span>
  );
}
