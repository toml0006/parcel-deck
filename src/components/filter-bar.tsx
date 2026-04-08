import Link from "next/link";

import { shipmentStatusOptions, shipmentStatusMeta } from "@/lib/shipments/status";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  q?: string | null;
  status?: string | null;
};

export function FilterBar({ q, status }: FilterBarProps) {
  const activeStatus = status ?? "all";

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.4)] backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Link
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              activeStatus === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:text-slate-950",
            )}
            href={q ? `/?q=${encodeURIComponent(q)}` : "/"}
          >
            All packages
          </Link>
          {shipmentStatusOptions.map((shipmentStatus) => (
            <Link
              key={shipmentStatus}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                activeStatus === shipmentStatus
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:text-slate-950",
              )}
              href={`/?status=${shipmentStatus}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              {shipmentStatusMeta[shipmentStatus].label}
            </Link>
          ))}
        </div>
        <form action="/" className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            aria-label="Search shipments"
            className="rounded-full border border-slate-200 bg-white/90 px-5 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
            defaultValue={q ?? ""}
            name="q"
            placeholder="Search by merchant, tracking number, or order number"
            type="search"
          />
          {status ? <input name="status" type="hidden" value={status} /> : null}
          <button
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            type="submit"
          >
            Refine view
          </button>
        </form>
      </div>
    </section>
  );
}
