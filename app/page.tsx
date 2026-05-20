import Link from "next/link"

/**
 * Qwikeer landing page.
 *
 * Simple first page for the clean rebuild.
 * Later, we can turn this into a full marketing homepage.
 */

export default function HomePage() {
  return (
    <main className="p-6">
      <section className="mx-auto grid max-w-7xl gap-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:p-12">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
            Qwikeer
          </p>

          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.08em] text-slate-950 md:text-7xl">
            Predict what happens next.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600">
            Qwikeer is a clean prediction market platform where users can trade
            their view on future outcomes using YES and NO markets.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/markets"
              className="rounded-2xl bg-[#FF7A1A] px-6 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#E85F00]"
            >
              Browse markets
            </Link>

            <Link
              href="/portfolio"
              className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              View portfolio
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-sm md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-400">
            Engine-first rebuild
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-[-0.05em]">
            Built clean from the start.
          </h2>

          <div className="mt-6 grid gap-3 text-sm font-semibold text-slate-300">
            <p>✅ New secured prediction market engine</p>
            <p>✅ YES/NO outcomes for every market</p>
            <p>✅ Wallets, positions, orders, trades and ledger</p>
            <p>✅ Admin-managed market creation and resolution</p>
            <p>✅ No old /api/trade system</p>
          </div>
        </div>
      </section>
    </main>
  )
}