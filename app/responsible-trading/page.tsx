import Link from "next/link"

/**
 * Qwikeer Responsible Trading Page
 *
 * Starter responsible trading guidance.
 */

export default function ResponsibleTradingPage() {
  return (
    <main className="p-6">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
          Qwikeer Trust
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
          Responsible Trading
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          Qwikeer encourages users to trade carefully, understand risk, and
          avoid harmful behavior.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              1. Trade Only What You Can Afford to Lose
            </h2>
            <p className="mt-2">
              Never use money needed for rent, food, school fees, medical needs,
              debt payments, family support, or other essential expenses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              2. Set Limits
            </h2>
            <p className="mt-2">
              Decide in advance how much time and money you are comfortable
              using. Stop trading when you reach your limit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              3. Do Not Chase Losses
            </h2>
            <p className="mt-2">
              Trying to recover losses quickly can lead to bigger losses. Take a
              break when you feel pressure, anger, fear, or urgency.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              4. Understand Every Market
            </h2>
            <p className="mt-2">
              Before trading, read the market title, description, close time,
              resolution criteria, and any available evidence. Do not trade
              markets you do not understand.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              5. Take Breaks
            </h2>
            <p className="mt-2">
              Trading should not harm your health, sleep, relationships, job,
              school, or finances. If it does, stop and seek support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              6. Warning Signs
            </h2>
            <p className="mt-2">
              Warning signs include hiding trading activity, borrowing money to
              trade, lying about losses, feeling unable to stop, or trading to
              escape stress.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              7. Platform Tools
            </h2>
            <p className="mt-2">
              Qwikeer may add tools such as deposit limits, withdrawal delays,
              cooling-off periods, account restrictions, and self-exclusion to
              support responsible use.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/risk-disclosure"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Risk Disclosure
          </Link>

          <Link
            href="/help"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Help Center
          </Link>
        </div>
      </section>
    </main>
  )
}