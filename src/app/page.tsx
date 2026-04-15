import { DashboardStats } from "@/components/dashboard-stats";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { LiveShipmentRefresh } from "@/components/live-shipment-refresh";
import { PriorityCard } from "@/components/priority-card";
import { SetupPanel } from "@/components/setup-panel";
import { ShipmentTable } from "@/components/shipment-table";
import { getDashboardData } from "@/lib/shipments/queries";
import { isToday } from "date-fns";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(value: string | string[] | undefined): string | null {
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

  const priority = data.shipments.filter((s) => {
    if (s.currentStatus === "exception" || s.currentStatus === "out_for_delivery") return true;
    if (s.estimatedDelivery && isToday(s.estimatedDelivery)) return true;
    return false;
  });

  const tableShipments = data.shipments
    .filter((s) => !priority.some((p) => p.id === s.id))
    .map((s) => {
      const trackingArtifact = s.artifacts.find((a) => a.key === "tracking");
      const emailArtifact = s.artifacts.find((a) => a.key === "source-email");
      const latest = s.events[0];
      const md = (s.metadata ?? {}) as Record<string, unknown>;
      const scrapeError =
        typeof md.lastScrapeError === "string" ? md.lastScrapeError : null;
      return {
        id: s.id,
        currentStatus: s.currentStatus,
        merchant: s.merchant,
        itemSummary: s.itemSummary,
        carrier: s.carrier,
        trackingNumber: s.trackingNumber,
        estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
        lastEventAt: latest?.occurredAt.toISOString() ?? s.lastEventAt?.toISOString() ?? null,
        lastEventDescription: latest?.description ?? null,
        createdAt: s.createdAt.toISOString(),
        trackingUrl: trackingArtifact?.url ?? s.trackingUrl ?? null,
        sourceEmailUrl: emailArtifact?.url ?? null,
        lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
        scrapeError,
      };
    });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-slate-950">Parcel Deck</h1>
            <p className="text-sm text-slate-500">
              All inbound packages at a glance.
            </p>
          </div>
          <LiveShipmentRefresh />
        </header>

        {data.error ? <SetupPanel error={data.error} /> : null}

        <div className="space-y-5">
          <DashboardStats {...data.stats} />
          <FilterBar q={q} status={status} />

          {!data.error && data.shipments.length === 0 ? <EmptyState /> : null}

          {priority.length ? (
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                  Priority
                </h2>
                <span className="text-xs text-slate-400">
                  {priority.length} {priority.length === 1 ? "package" : "packages"}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {priority.map((shipment) => (
                  <PriorityCard key={shipment.id} shipment={shipment} />
                ))}
              </div>
            </section>
          ) : null}

          {tableShipments.length || data.shipments.length > priority.length ? (
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                  All packages
                </h2>
                <span className="text-xs text-slate-400">
                  {tableShipments.length} {tableShipments.length === 1 ? "package" : "packages"}
                </span>
              </div>
              <ShipmentTable shipments={tableShipments} />
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
