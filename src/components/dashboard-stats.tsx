import { PackageCheck, PackageSearch, Siren, Truck } from "lucide-react";

type DashboardStatsProps = {
  active: number;
  attention: number;
  deliveredRecently: number;
  outToday: number;
};

const statCards = [
  { icon: Truck, key: "outToday", label: "Out for delivery", accent: "text-amber-600" },
  { icon: PackageSearch, key: "active", label: "In transit", accent: "text-cyan-600" },
  { icon: Siren, key: "attention", label: "Needs attention", accent: "text-rose-600" },
  { icon: PackageCheck, key: "deliveredRecently", label: "Delivered this week", accent: "text-emerald-600" },
] as const;

export function DashboardStats(props: DashboardStatsProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <Icon className={`size-5 ${card.accent}`} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {card.label}
              </p>
              <p className="text-2xl font-semibold text-slate-950 leading-none mt-0.5">
                {props[card.key]}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
