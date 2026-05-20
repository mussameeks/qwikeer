import Link from "next/link"

/**
 * Qwikeer Help Page
 *
 * Starter help center.
 */

export default function HelpPage() {
  return (
    <main className="p-6">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
            Qwikeer Help
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
            How can we help?
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
            Learn how Qwikeer markets, orders, deposits, withdrawals,
            resolution, and wallet records work.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <HelpCard
            title="How prediction markets work"
            text="Each market has outcomes such as YES and NO. Users can buy or sell shares based on what they think will happen."
          />

          <HelpCard
            title="What YES and NO prices mean"
            text="A YES price of 60¢ means the market is pricing YES at 60 cents. If YES wins, each YES share pays 100¢."
          />

          <HelpCard
            title="How orders work"
            text="A buy or sell order may be filled immediately if it matches another order, or it may stay open in the orderbook."
          />

          <HelpCard
            title="Why funds become locked"
            text="Funds can be locked for open buy orders or pending withdrawals. Locked shares can happen when placing sell orders."
          />

          <HelpCard
            title="How complete sets work"
            text="Minting complete sets gives equal YES and NO shares. This is useful when a user wants to sell shares into the market."
          />

          <HelpCard
            title="How deposits work"
            text="In the manual flow, users submit a deposit request with payment details. Admin approves the request before wallet balance increases."
          />

          <HelpCard
            title="How withdrawals work"
            text="Users submit withdrawal details. The requested amount is locked while pending. Admin approval removes the funds from the wallet."
          />

          <HelpCard
            title="How market resolution works"
            text="When an event result is known, admin selects the winning outcome. Winning shares pay 100¢ and losing shares pay 0¢."
          />
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Important links
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/terms" label="Terms of Use" />
            <LinkButton href="/privacy" label="Privacy Policy" />
            <LinkButton href="/risk-disclosure" label="Risk Disclosure" />
            <LinkButton href="/responsible-trading" label="Responsible Trading" />
            <LinkButton href="/wallet" label="Wallet" />
            <LinkButton href="/ledger" label="Ledger" />
          </div>
        </div>

        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm font-semibold leading-6 text-amber-800 shadow-sm">
          Qwikeer is still under development. Before using real money, make sure
          the platform has legal review, licensing review, KYC controls,
          payment provider controls, and production security checks.
        </div>
      </section>
    </main>
  )
}

function HelpCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
        {title}
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  )
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
    >
      {label}
    </Link>
  )
}