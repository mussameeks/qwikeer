import Link from "next/link"

/**
 * Qwikeer Terms of Use
 *
 * Starter legal/trust page.
 * This is not final legal advice.
 */

export default function TermsPage() {
  return (
    <main className="p-6">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
          Qwikeer Legal
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
          Terms of Use
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          These Terms explain the basic rules for using Qwikeer. This draft is a
          product foundation and should be reviewed by a qualified legal
          professional before public launch.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              1. Acceptance of Terms
            </h2>
            <p className="mt-2">
              By accessing or using Qwikeer, you agree to follow these Terms and
              any additional rules, market resolution policies, risk notices, or
              platform guidelines published by Qwikeer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              2. Eligibility
            </h2>
            <p className="mt-2">
              You may only use Qwikeer if you are legally allowed to use
              prediction market, trading, or related financial products in your
              jurisdiction. Qwikeer may require identity verification, age
              verification, location checks, or other compliance checks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              3. Account Responsibility
            </h2>
            <p className="mt-2">
              You are responsible for keeping your account secure. You must not
              share account access, impersonate another person, attempt to
              bypass restrictions, or use Qwikeer for fraudulent activity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              4. Market Rules
            </h2>
            <p className="mt-2">
              Each market should have clear resolution criteria. Qwikeer may
              pause, close, cancel, or resolve markets based on available
              evidence, official sources, operational requirements, or legal and
              compliance concerns.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              5. Trading Risk
            </h2>
            <p className="mt-2">
              Prediction market trading involves risk. You may lose some or all
              of the funds used to trade. Prices may move quickly, liquidity may
              be limited, and outcomes may be uncertain until final resolution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              6. Deposits and Withdrawals
            </h2>
            <p className="mt-2">
              Deposits and withdrawals may be subject to verification, manual
              review, limits, compliance checks, processing delays, or rejection
              where required by platform rules or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              7. Prohibited Conduct
            </h2>
            <p className="mt-2">
              You must not abuse Qwikeer, manipulate markets, create fake
              volume, use unauthorized bots, exploit bugs, launder money,
              violate sanctions, or engage in activity that harms Qwikeer or
              other users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              8. Platform Changes
            </h2>
            <p className="mt-2">
              Qwikeer may update features, fees, market categories, rules, or
              access requirements. Continued use of the platform may mean you
              accept updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              9. No Investment Advice
            </h2>
            <p className="mt-2">
              Qwikeer does not provide financial, legal, tax, or investment
              advice. You are responsible for your own decisions and should seek
              professional advice where needed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              10. Contact
            </h2>
            <p className="mt-2">
              For questions about these Terms, contact the Qwikeer support team
              using the Help page.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Privacy Policy
          </Link>

          <Link
            href="/risk-disclosure"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Risk Disclosure
          </Link>
        </div>
      </section>
    </main>
  )
}