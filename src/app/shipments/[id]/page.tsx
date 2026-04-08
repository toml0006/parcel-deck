import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, ArrowUpRight, Mail, Package, Store, Waypoints } from "lucide-react";

import { LiveShipmentRefresh } from "@/components/live-shipment-refresh";
import { SectionHeading } from "@/components/section-heading";
import { SetupPanel } from "@/components/setup-panel";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { formatCompactDate, formatDateTime, formatOptionalText } from "@/lib/format";
import { getCarrierLabel } from "@/lib/shipments/carriers";
import { getShipmentDetail } from "@/lib/shipments/queries";

export const dynamic = "force-dynamic";

type ShipmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ShipmentDetailPage({ params }: ShipmentDetailPageProps) {
  const { id } = await params;
  const data = await getShipmentDetail(id);

  if (data.error) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 md:px-10">
        <SetupPanel error={data.error} />
      </main>
    );
  }

  if (!data.shipment) {
    notFound();
  }

  const shipment = data.shipment;

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_25%),radial-gradient(circle_at_84%_16%,_rgba(56,189,248,0.16),_transparent_22%),radial-gradient(circle_at_60%_90%,_rgba(16,185,129,0.12),_transparent_26%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8 md:px-10 md:py-10">
        <div>
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-950"
            href="/"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
          <div className="mt-4">
            <LiveShipmentRefresh />
          </div>
        </div>

        <section className="rounded-[2.5rem] border border-white/60 bg-white/70 p-7 shadow-[0_36px_90px_-42px_rgba(15,23,42,0.55)] backdrop-blur md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <StatusBadge className="mb-5" status={shipment.currentStatus} />
              <h1 className="max-w-3xl font-display text-5xl leading-[0.98] text-slate-950">
                {shipment.itemSummary || shipment.merchant || "Shipment detail"}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                {shipment.merchant ? `${shipment.merchant} · ` : ""}
                {shipment.orderNumber ? `Order ${shipment.orderNumber}` : "No order number on file"}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {shipment.artifacts.map((artifact) =>
                  artifact.url ? (
                    <a
                      key={artifact.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                      href={artifact.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ArrowUpRight className="size-4" />
                      {artifact.label}
                    </a>
                  ) : null,
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <article className="rounded-[1.8rem] border border-white/70 bg-slate-950 p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Delivery estimate
                </p>
                <p className="mt-3 font-display text-4xl">
                  {formatCompactDate(shipment.estimatedDelivery)}
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  Last synced {formatDateTime(shipment.lastSyncedAt)}
                </p>
              </article>
              <article className="rounded-[1.8rem] border border-white/70 bg-white/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Carrier
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">
                  {getCarrierLabel(shipment.carrier)}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  Tracking {shipment.trackingNumber ?? "Not available"}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <article className="rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.4)] backdrop-blur">
              <SectionHeading
                caption="Metadata"
                description="The core identifiers and provenance fields used by the board and ingest API."
                title="Package record"
              />
              <dl className="mt-6 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <Package className="size-4" />
                    Tracking number
                  </dt>
                  <dd className="mt-2 font-medium text-slate-950">
                    {shipment.trackingNumber ?? "Missing"}
                  </dd>
                </div>
                <div className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <Store className="size-4" />
                    Merchant
                  </dt>
                  <dd className="mt-2 font-medium text-slate-950">
                    {formatOptionalText(shipment.merchant)}
                  </dd>
                </div>
                <div className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <Waypoints className="size-4" />
                    Source message id
                  </dt>
                  <dd className="mt-2 font-medium text-slate-950">
                    {formatOptionalText(shipment.sourceMessageId)}
                  </dd>
                </div>
                <div className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <Mail className="size-4" />
                    Discovered via
                  </dt>
                  <dd className="mt-2 font-medium text-slate-950">
                    {shipment.source.replace(/_/g, " ")}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.4)] backdrop-blur">
              <SectionHeading
                caption="Source"
                description="Recent source records preserved from OpenClaw ingest, including the original raw excerpt when available."
                title="Ingest trail"
              />
              <div className="mt-6 space-y-4">
                {shipment.sourceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {record.source.replace(/_/g, " ")}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-950">
                      Source message id: {record.sourceMessageId ?? "Missing"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Created {formatDateTime(record.createdAt)}
                    </p>
                  </div>
                ))}
                {shipment.rawEmailExcerpt ? (
                  <div className="rounded-[1.5rem] bg-slate-950 p-5 text-sm leading-7 text-slate-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Raw email excerpt
                    </p>
                    <p className="mt-3 whitespace-pre-wrap">{shipment.rawEmailExcerpt}</p>
                  </div>
                ) : null}
              </div>
            </article>
          </div>

          <section className="space-y-5">
            <SectionHeading
              caption="Timeline"
              description="Every normalized event stored for the package, newest first."
              title="Shipment events"
            />
            <Timeline shipment={shipment} />
          </section>
        </section>
      </div>
    </main>
  );
}
