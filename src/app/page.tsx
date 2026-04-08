import { PackagePlus, ShieldCheck, Sparkles } from "lucide-react";

import { DashboardStats } from "@/components/dashboard-stats";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { LiveShipmentRefresh } from "@/components/live-shipment-refresh";
import { SectionHeading } from "@/components/section-heading";
import { SetupPanel } from "@/components/setup-panel";
import { ShipmentCard } from "@/components/shipment-card";
import { getDashboardData } from "@/lib/shipments/queries";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const q = getSingleValue(params.q);
  const status = getSingleValue(params.status);
  const data = await getDashboardData({ q, status });
  const highlighted = data.shipments.filter((shipment) =>
    ["out_for_delivery", "exception"].includes(shipment.currentStatus),
  );
  const active = data.shipments.filter(
    (shipment) => shipment.active && !highlighted.some((entry) => entry.id === shipment.id),
  );
  const delivered = data.shipments.filter((shipment) => !shipment.active);

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_28%),radial-gradient(circle_at_80%_12%,_rgba(251,191,36,0.24),_transparent_22%),radial-gradient(circle_at_60%_90%,_rgba(16,185,129,0.18),_transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-8 md:px-10 md:py-10">
        <section className="overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/68 p-7 shadow-[0_36px_90px_-42px_rgba(15,23,42,0.55)] backdrop-blur md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Parcel Deck
              </p>
              <div className="mt-4">
                <LiveShipmentRefresh />
              </div>
              <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1] text-slate-950 md:text-7xl">
                A household shipment board with an OpenClaw intake lane.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                Track everything that is still moving toward your door, not just raw tracking
                numbers. Each package carries merchant context, email provenance, timeline events,
                and direct carrier links.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.8rem] border border-white/70 bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/10 p-2">
                    <Sparkles className="size-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                    Visual board
                  </p>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-200">
                  Status-first cards, ETA visibility, and a timeline view for every shipment.
                </p>
              </div>
              <div className="rounded-[1.8rem] border border-white/70 bg-white/80 p-5">
                <div className="flex items-center gap-3 text-slate-900">
                  <span className="rounded-full bg-cyan-100 p-2">
                    <PackagePlus className="size-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    OpenClaw discovery
                  </p>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  OpenClaw agents only discover shipments from your email and hand them to Parcel
                  Deck.
                </p>
              </div>
              <div className="rounded-[1.8rem] border border-white/70 bg-white/80 p-5">
                <div className="flex items-center gap-3 text-slate-900">
                  <span className="rounded-full bg-emerald-100 p-2">
                    <ShieldCheck className="size-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    App-owned tracking
                  </p>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  EasyPost webhooks and app-side refresh keep tracking updates inside Parcel Deck
                  instead of OpenClaw.
                </p>
              </div>
            </div>
          </div>
        </section>

        {data.error ? <SetupPanel error={data.error} /> : null}

        <DashboardStats {...data.stats} />
        <FilterBar q={q} status={status} />

        {!data.error && data.shipments.length === 0 ? <EmptyState /> : null}

        {highlighted.length ? (
          <section className="space-y-5">
            <SectionHeading
              caption="Front of line"
              description="The packages most likely to need a glance right now: today's arrivals and anything with a problem state."
              title="Priority parcels"
            />
            <div className="grid gap-5 xl:grid-cols-2">
              {highlighted.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          </section>
        ) : null}

        {active.length ? (
          <section className="space-y-5">
            <SectionHeading
              caption="In motion"
              description="Everything that is still moving toward the house, sorted by urgency and ETA."
              title="Transit lane"
            />
            <div className="grid gap-5 xl:grid-cols-2">
              {active.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          </section>
        ) : null}

        {delivered.length ? (
          <section className="space-y-5">
            <SectionHeading
              caption="Archive"
              description="Recently completed deliveries stay visible here so the board retains short-term memory."
              title="Recently landed"
            />
            <div className="grid gap-5 xl:grid-cols-2">
              {delivered.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
