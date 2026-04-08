"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

type LiveShipmentRefreshProps = {
  className?: string;
};

export function LiveShipmentRefresh({ className }: LiveShipmentRefreshProps) {
  const router = useRouter();
  const [state, setState] = useState<"connecting" | "live" | "reconnecting">("connecting");

  const handleRefresh = useEffectEvent(() => {
    startTransition(() => {
      router.refresh();
      setState("live");
    });
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      setState((current) => (current === "live" ? current : "connecting"));
      source = new EventSource("/api/shipments/live");

      source.addEventListener("ready", () => {
        setState("live");
      });

      source.addEventListener("shipment-change", () => {
        handleRefresh();
      });

      source.onerror = () => {
        setState("reconnecting");
        source?.close();
        retryTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      source?.close();
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  const label =
    state === "live"
      ? "Live app-owned tracking"
      : state === "connecting"
        ? "Connecting live tracking"
        : "Reconnecting live tracking";

  return (
    <div
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm backdrop-blur"
      }
    >
      <span
        className={`size-2 rounded-full ${
          state === "live"
            ? "bg-emerald-500"
            : state === "connecting"
              ? "bg-amber-500"
              : "bg-rose-500"
        }`}
      />
      <span>{label}</span>
    </div>
  );
}
