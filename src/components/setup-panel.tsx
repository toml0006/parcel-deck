export function SetupPanel({ error }: { error: string }) {
  return (
    <section className="rounded-[2rem] border border-rose-200/70 bg-rose-50/80 p-6 shadow-[0_20px_50px_-32px_rgba(136,19,55,0.6)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
        Setup required
      </p>
      <h2 className="mt-3 font-display text-3xl text-rose-950">
        Postgres is not reachable yet.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-rose-900/80">
        Start the local stack with <code className="rounded bg-white/70 px-2 py-1">docker compose up --build</code>,
        then run <code className="rounded bg-white/70 px-2 py-1">npm run db:push</code> and optionally{" "}
        <code className="rounded bg-white/70 px-2 py-1">npm run db:seed</code>. The current database error
        was: {error}
      </p>
    </section>
  );
}
