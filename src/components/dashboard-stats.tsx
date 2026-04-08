import { ArrowRight, PackageCheck, PackageSearch, Siren, Truck } from "lucide-react";

type DashboardStatsProps = {
  active: number;
  attention: number;
  deliveredRecently: number;
  outToday: number;
};

const statCards = [
  {
    bodyClassName: "from-cyan-300/30 via-white/70 to-white/30",
    icon: Truck,
    key: "outToday",
    label: "Arriving today",
  },
  {
    bodyClassName: "from-amber-300/30 via-white/70 to-white/30",
    icon: PackageSearch,
    key: "active",
    label: "Still moving",
  },
  {
    bodyClassName: "from-rose-300/30 via-white/70 to-white/30",
    icon: Siren,
    key: "attention",
    label: "Needs attention",
  },
  {
    bodyClassName: "from-emerald-300/30 via-white/70 to-white/30",
    icon: PackageCheck,
    key: "deliveredRecently",
    label: "Delivered this week",
  },
] as const;

export function DashboardStats(props: DashboardStatsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            key={card.key}
            className={`rounded-[2rem] border border-white/60 bg-linear-to-br ${card.bodyClassName} p-5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] backdrop-blur`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {card.label}
                </p>
                <p className="mt-3 font-display text-4xl text-slate-950">
                  {props[card.key]}
                </p>
              </div>
              <span className="rounded-full border border-slate-200/70 bg-white/80 p-3 text-slate-900 shadow-sm">
                <Icon className="size-5" />
              </span>
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
              <ArrowRight className="size-4" />
              <span>Live from OpenClaw ingest</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
