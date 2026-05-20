import Link from "next/link"

/**
 * Qwikeer Risk Disclosure
 *
 * Starter risk disclosure page.
 */

export default function RiskDisclosurePage() {
  return (
    <main className="p-6">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
          Qwikeer Trust
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
          Risk Disclosure
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          Prediction market trading involves risk. Read this carefully before
          using Qwikeer.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              1. You Can Lose Money
            </h2>
            <p className="mt-2">
              Trading outcomes is risky. If a market resolves against your
              position, the value of your shares may become zero. Do not trade
              money you cannot afford to lose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              2. Prices Can Move Quickly
            </h2>
            <p className="mt-2">
              Market prices may change quickly based on news, user activity,
              liquidity, rumors, or new information. A price shown on Qwikeer is
              not a guarantee of final outcome probability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              3. Liquidity Risk
            </h2>
            <p className="mt-2">
              You may not always be able to buy or sell at your desired price.
              Some markets may have limited liquidity, wide spreads, or no
              available matching orders.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              4. Resolution Risk
            </h2>
            <p className="mt-2">
              Market resolution depends on the market rules and available
              evidence. Ambiguous events, postponed events, conflicting sources,
              or missing data may lead to delayed resolution, cancellation, or
              admin review.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              5. Operational Risk
            </h2>
            <p className="mt-2">
              Technical issues, internet problems, database errors, payment
              delays, or third-party service interruptions may affect platform
              access, deposits, withdrawals, or trading availability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              6. Legal and Regulatory Risk
            </h2>
            <p className="mt-2">
              Prediction market rules vary by country and may change. Your
              access to Qwikeer may be restricted based on location, regulation,
              licensing, age, identity verification, or compliance requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              7. No Guaranteed Profit
            </h2>
            <p className="mt-2">
              Qwikeer does not guarantee profits, returns, winning outcomes, or
              liquidity. Past market behavior does not guarantee future results.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/responsible-trading"
            className="rounded-2xl bg-[#FF7A1A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#E85F00]"
          >
            Responsible Trading
          </Link>

          <Link
            href="/terms"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Terms of Use
          </Link>
        </div>
      </section>
    </main>
  )
}