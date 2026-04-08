import { env } from "@/lib/env";
import { runRefreshCycle } from "@/lib/shipments/provider";

const intervalMs = Number.isFinite(env.workerIntervalMs) ? env.workerIntervalMs : 5 * 60 * 1000;

let keepRunning = true;

async function executeCycle() {
  const startedAt = new Date();
  console.log(`[worker] refresh cycle started at ${startedAt.toISOString()}`);

  try {
    const result = await runRefreshCycle();
    console.log(`[worker] refreshed ${result.refreshed} shipments`);
  } catch (error) {
    console.error(
      "[worker] refresh cycle failed",
      error instanceof Error ? error.message : error,
    );
  }
}

async function main() {
  await executeCycle();

  while (keepRunning) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (!keepRunning) {
      break;
    }

    await executeCycle();
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    keepRunning = false;
  });
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exitCode = 1;
});
