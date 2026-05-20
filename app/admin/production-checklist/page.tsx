import Link from "next/link"

/**
 * Qwikeer Production Checklist Page
 *
 * This page is a launch readiness checklist.
 *
 * It does not automatically verify everything yet.
 * It gives admin a structured checklist before production launch.
 */

type ChecklistItem = {
  title: string
  description: string
  status: "done" | "needs_review" | "critical"
}

type ChecklistSection = {
  title: string
  description: string
  items: ChecklistItem[]
}

const sections: ChecklistSection[] = [
  {
    title: "Environment",
    description:
      "Confirm environment variables and production configuration are correct.",
    items: [
      {
        title: "Supabase URL configured",
        description:
          "NEXT_PUBLIC_SUPABASE_URL must be set in Vercel production environment.",
        status: "done",
      },
      {
        title: "Supabase anon key configured",
        description:
          "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for browser Supabase auth.",
        status: "done",
      },
      {
        title: "Supabase service role key configured",
        description:
          "SUPABASE_SERVICE_ROLE_KEY must be server-only and never exposed to browser code.",
        status: "critical",
      },
      {
        title: "Dev tools disabled in production",
        description:
          "QWIKEER_DEV_TOOLS_ENABLED must be false in production. Demo credit and liquidity tools must not be available to normal production operations.",
        status: "critical",
      },
      {
        title: "Production site URL configured",
        description:
          "NEXT_PUBLIC_SITE_URL should point to your real production domain for redirects and public links.",
        status: "needs_review",
      },
    ],
  },
  {
    title: "Database Security",
    description:
      "Confirm RLS, sensitive RPC permissions, and table access are safe.",
    items: [
      {
        title: "RLS enabled on sensitive tables",
        description:
          "wallets, positions, orders, ledger_entries, money_requests, user_profiles, market_admins, and admin_audit_logs should have RLS enabled.",
        status: "critical",
      },
      {
        title: "Sensitive RPCs revoked from browser roles",
        description:
          "place_order, cancel_order, mint_complete_sets, resolve_market, cancel_market, credit_demo_balance, create_money_request, review_money_request, and admin update RPCs should be revoked from anon/authenticated and granted only to service_role.",
        status: "critical",
      },
      {
        title: "Frontend never writes balances directly",
        description:
          "Wallets, positions, ledger entries, and settlements should only change through secure server routes and database RPCs.",
        status: "done",
      },
      {
        title: "Ledger entries created for wallet movements",
        description:
          "Deposits, withdrawals, order locks, unlocks, trades, refunds, minting, and payouts should write ledger entries.",
        status: "done",
      },
    ],
  },
  {
    title: "Trading Engine",
    description:
      "Confirm trading behavior is predictable and protected.",
    items: [
      {
        title: "Order placement uses server API",
        description:
          "Users should place orders through /api/orders, not direct database calls.",
        status: "done",
      },
      {
        title: "Self-match protection enabled",
        description:
          "A user should not be able to match against their own order and create fake volume.",
        status: "done",
      },
      {
        title: "Market status respected",
        description:
          "Trading should only work when market status is open and market has not passed close time.",
        status: "done",
      },
      {
        title: "Resolution flow tested",
        description:
          "Admin should resolve a market and confirm winners are paid, losing positions cleared, open orders refunded, and ledger updated.",
        status: "needs_review",
      },
      {
        title: "Cancellation flow tested",
        description:
          "Admin should cancel a safe/no-trade market and confirm orders and positions are refunded correctly.",
        status: "needs_review",
      },
    ],
  },
  {
    title: "Money Flow",
    description:
      "Confirm deposits and withdrawals are controlled and auditable.",
    items: [
      {
        title: "Manual deposits enabled",
        description:
          "User submits deposit request, admin approves, wallet increases, and ledger shows deposit.",
        status: "done",
      },
      {
        title: "Manual withdrawals enabled",
        description:
          "User submits withdrawal request, amount locks, admin approves or rejects, wallet and ledger update correctly.",
        status: "done",
      },
      {
        title: "Withdrawal requires verified account",
        description:
          "Unverified, pending, rejected, and suspended users should not withdraw.",
        status: "done",
      },
      {
        title: "Deposit and withdrawal limits enforced",
        description:
          "User cannot request more than admin-set deposit_limit_cents or withdrawal_limit_cents.",
        status: "done",
      },
      {
        title: "Real payment provider not connected yet",
        description:
          "Before real launch, decide whether to integrate MTN MoMo, Airtel Money, Flutterwave, bank transfer, or manual operations.",
        status: "needs_review",
      },
    ],
  },
  {
    title: "KYC and Compliance",
    description:
      "Confirm user verification and account restrictions are ready.",
    items: [
      {
        title: "User profile page exists",
        description:
          "Users can submit full name, phone number, and country from /profile.",
        status: "done",
      },
      {
        title: "Admin user management exists",
        description:
          "Admin can verify, reject, suspend, and set account limits from /admin/users.",
        status: "done",
      },
      {
        title: "Rejected and suspended users blocked",
        description:
          "Rejected and suspended accounts should be blocked from money request creation.",
        status: "done",
      },
      {
        title: "Legal and regulatory review needed",
        description:
          "Prediction markets can require licensing, KYC, AML, responsible trading controls, and jurisdiction restrictions.",
        status: "critical",
      },
      {
        title: "KYC document upload not yet implemented",
        description:
          "Current KYC is readiness only. Real KYC needs document upload or external KYC provider integration.",
        status: "needs_review",
      },
    ],
  },
  {
    title: "Admin Controls",
    description:
      "Confirm admin actions are restricted and logged.",
    items: [
      {
        title: "Admin routes check market_admins",
        description:
          "Every admin route should verify logged-in user and confirm they exist in public.market_admins.",
        status: "critical",
      },
      {
        title: "Audit logs enabled",
        description:
          "Admin actions such as market creation, edits, resolution, cancellation, money request review, demo credit, liquidity, and user profile updates should write admin audit logs.",
        status: "done",
      },
      {
        title: "Audit logs page exists",
        description:
          "Admin can review logs at /admin/audit-logs.",
        status: "done",
      },
      {
        title: "Admin liquidity is dev-only",
        description:
          "Liquidity tool must be disabled in production or restricted to special operational roles.",
        status: "critical",
      },
      {
        title: "Demo credit is dev-only",
        description:
          "Credit balance route must not be enabled for public production use.",
        status: "critical",
      },
    ],
  },
  {
    title: "Legal and Trust Pages",
    description:
      "Confirm public trust pages exist before launch.",
    items: [
      {
        title: "Terms of Use",
        description: "Terms page exists at /terms.",
        status: "done",
      },
      {
        title: "Privacy Policy",
        description: "Privacy page exists at /privacy.",
        status: "done",
      },
      {
        title: "Risk Disclosure",
        description: "Risk page exists at /risk-disclosure.",
        status: "done",
      },
      {
        title: "Responsible Trading",
        description:
          "Responsible trading guidance exists at /responsible-trading.",
        status: "done",
      },
      {
        title: "Legal review required",
        description:
          "Starter templates are not final legal advice. A qualified legal professional should review them before production.",
        status: "critical",
      },
    ],
  },
  {
    title: "Monitoring and Operations",
    description:
      "Confirm operational safety before real users and money.",
    items: [
      {
        title: "Error monitoring not yet connected",
        description:
          "Consider Sentry or Vercel monitoring for runtime errors and API failures.",
        status: "needs_review",
      },
      {
        title: "Database backup plan needed",
        description:
          "Define backup, restore, and incident response procedures before production.",
        status: "critical",
      },
      {
        title: "Rate limiting foundation exists",
        description:
          "In-memory rate limiter exists for dev, but production should use Redis/Upstash or database-backed rate limiting.",
        status: "needs_review",
      },
      {
        title: "Admin correction flow not yet built",
        description:
          "If a market is resolved incorrectly, do not manually edit balances. Build a controlled correction flow later.",
        status: "needs_review",
      },
    ],
  },
]

function statusClass(status: ChecklistItem["status"]) {
  if (status === "done") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (status === "critical") {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  return "bg-amber-50 text-amber-700 ring-amber-200"
}

function statusLabel(status: ChecklistItem["status"]) {
  if (status === "done") return "Done"
  if (status === "critical") return "Critical"
  return "Needs review"
}

export default function ProductionChecklistPage() {
  const allItems = sections.flatMap((section) => section.items)
  const doneCount = allItems.filter((item) => item.status === "done").length
  const needsReviewCount = allItems.filter(
    (item) => item.status === "needs_review"
  ).length
  const criticalCount = allItems.filter(
    (item) => item.status === "critical"
  ).length

  return (
    <main className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                Qwikeer Admin
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
                Production checklist.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Use this checklist before deploying Qwikeer with real users or
                real money. Items marked critical should be handled before
                public launch.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/environment"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Environment
              </Link>

              <Link
                href="/admin/audit-logs"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Audit logs
              </Link>

              <Link
                href="/admin"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Back to admin
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Total checks
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {allItems.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Done
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-700">
              {doneCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Needs review
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-amber-700">
              {needsReviewCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Critical
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-red-700">
              {criticalCount}
            </p>
          </div>
        </section>

        {criticalCount > 0 && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
            Critical items remain. Do not launch Qwikeer publicly with real
            money until these are reviewed and fixed.
          </section>
        )}

        <section className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                  {section.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {section.description}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {section.items.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-black text-slate-950">
                          {item.title}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {item.description}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm font-semibold leading-6 text-amber-800 shadow-sm">
          This checklist is a product and engineering guide, not legal advice.
          Prediction markets, trading, deposits, withdrawals, and KYC/AML rules
          may require licensing or regulator approval depending on where Qwikeer
          operates.
        </section>
      </div>
    </main>
  )
}