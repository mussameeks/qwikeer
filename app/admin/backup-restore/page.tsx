import Link from "next/link"

/**
 * Qwikeer Backup / Restore / Operations Safety Page
 *
 * This is an admin operational checklist.
 *
 * Purpose:
 * - Prevent dangerous manual database actions
 * - Create a safe pre-deployment checklist
 * - Guide incident response
 * - Keep wallet/payment/market corrections controlled
 */

type ChecklistItem = {
  title: string
  description: string
  level: "safe" | "warning" | "critical"
}

type Section = {
  title: string
  description: string
  items: ChecklistItem[]
}

const sections: Section[] = [
  {
    title: "Backup policy",
    description:
      "Before Qwikeer handles real users or real money, backups must be treated as part of the product, not an afterthought.",
    items: [
      {
        title: "Enable Supabase backups",
        description:
          "Confirm your Supabase plan supports backups and point-in-time recovery before production launch.",
        level: "critical",
      },
      {
        title: "Backup before major SQL changes",
        description:
          "Before running migrations, SQL patches, or function replacements, create a database backup or confirm recent restore point availability.",
        level: "critical",
      },
      {
        title: "Keep migrations in Git",
        description:
          "Every database change should exist in supabase/migrations so the database can be rebuilt later.",
        level: "safe",
      },
      {
        title: "Export critical operational data",
        description:
          "Before launch, define how to export markets, orders, trades, wallets, ledger entries, money requests, and audit logs.",
        level: "warning",
      },
    ],
  },
  {
    title: "Before deployment",
    description:
      "Use this checklist before deploying to Vercel or changing production environment variables.",
    items: [
      {
        title: "Run lint and build locally",
        description:
          "Run npm run lint and npm run build before production deployment.",
        level: "safe",
      },
      {
        title: "Check environment page",
        description:
          "Open /admin/environment and confirm required environment variables and database health are OK.",
        level: "safe",
      },
      {
        title: "Disable dev tools in production",
        description:
          "Set QWIKEER_DEV_TOOLS_ENABLED=false and NEXT_PUBLIC_QWIKEER_DEV_TOOLS_ENABLED=false in production.",
        level: "critical",
      },
      {
        title: "Confirm service role key is server-only",
        description:
          "SUPABASE_SERVICE_ROLE_KEY must never be used in client components or exposed through NEXT_PUBLIC variables.",
        level: "critical",
      },
    ],
  },
  {
    title: "Before running SQL",
    description:
      "SQL changes can affect wallets, orders, trades, positions, and payouts. Treat every SQL operation carefully.",
    items: [
      {
        title: "Never run unreviewed SQL on production",
        description:
          "Test SQL on a development database first. Do not paste experimental SQL directly into production.",
        level: "critical",
      },
      {
        title: "Check migration order",
        description:
          "Run migrations in order: 001 core schema, 002 trading engine RPC, 003 money/KYC/audit, 004 security hardening.",
        level: "warning",
      },
      {
        title: "Avoid manual wallet edits",
        description:
          "Do not directly update wallets.available_cents or wallets.locked_cents. Use controlled RPCs and ledger entries.",
        level: "critical",
      },
      {
        title: "Do not manually delete trades",
        description:
          "Trades are permanent financial records. Deleting trades can destroy auditability and user trust.",
        level: "critical",
      },
    ],
  },
  {
    title: "Restore plan",
    description:
      "A restore plan explains what to do when data is damaged, deleted, or corrupted.",
    items: [
      {
        title: "Know your restore window",
        description:
          "Document how far back Supabase can restore your database and how long restoration takes.",
        level: "warning",
      },
      {
        title: "Pause user actions before restore",
        description:
          "If restoring production data, pause trading, deposits, withdrawals, and market resolution first.",
        level: "critical",
      },
      {
        title: "Compare ledger before and after",
        description:
          "After restoration, compare ledger_entries, wallets, orders, positions, and money_requests for consistency.",
        level: "critical",
      },
      {
        title: "Notify affected users",
        description:
          "If balances, trades, deposits, or withdrawals were affected, prepare a transparent user communication plan.",
        level: "warning",
      },
    ],
  },
  {
    title: "Market resolution incidents",
    description:
      "Wrong market resolution is one of the most dangerous admin mistakes on a prediction market.",
    items: [
      {
        title: "Do not manually reverse balances",
        description:
          "If a market is resolved incorrectly, do not manually edit wallets or positions. Build/use a controlled correction flow.",
        level: "critical",
      },
      {
        title: "Preserve audit logs",
        description:
          "Keep admin_audit_logs intact. They show who resolved the market and what metadata was used.",
        level: "critical",
      },
      {
        title: "Freeze affected market",
        description:
          "Pause or lock actions related to the affected market while investigating.",
        level: "warning",
      },
      {
        title: "Create correction report",
        description:
          "Document the market, wrong outcome, correct outcome, affected users, affected ledger entries, and proposed correction.",
        level: "warning",
      },
    ],
  },
  {
    title: "Payment incidents",
    description:
      "Deposits and withdrawals must be reconciled carefully, especially before real payment integration.",
    items: [
      {
        title: "Never approve unverified deposits",
        description:
          "Only approve deposits after confirming payment reference, amount, and sender details.",
        level: "critical",
      },
      {
        title: "Handle duplicate payment references",
        description:
          "Before payment integration, design logic to detect duplicate transaction references.",
        level: "warning",
      },
      {
        title: "Withdrawal approval requires final check",
        description:
          "Before approving withdrawal, confirm account name, account number, amount, and user verification status.",
        level: "critical",
      },
      {
        title: "Keep payment proof outside chat",
        description:
          "Sensitive payment proof and identity documents should be stored securely, not casually shared in chat or screenshots.",
        level: "warning",
      },
    ],
  },
  {
    title: "What not to do manually",
    description:
      "These actions can permanently damage financial consistency.",
    items: [
      {
        title: "Do not edit wallet balances directly",
        description:
          "All balance changes must have corresponding ledger entries and clear reason.",
        level: "critical",
      },
      {
        title: "Do not delete ledger entries",
        description:
          "Ledger entries are the financial history. Corrections should be new ledger entries, not deleted old entries.",
        level: "critical",
      },
      {
        title: "Do not delete audit logs",
        description:
          "Audit logs are necessary for accountability and dispute handling.",
        level: "critical",
      },
      {
        title: "Do not resolve markets without source evidence",
        description:
          "Every resolution should have a clear source and resolution note.",
        level: "critical",
      },
    ],
  },
]

function levelClass(level: ChecklistItem["level"]) {
  if (level === "safe") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (level === "critical") {
    return "bg-red-50 text-red-700 ring-red-200"
  }

  return "bg-amber-50 text-amber-700 ring-amber-200"
}

function levelLabel(level: ChecklistItem["level"]) {
  if (level === "safe") return "Safe"
  if (level === "critical") return "Critical"
  return "Review"
}

export default function BackupRestorePage() {
  const allItems = sections.flatMap((section) => section.items)
  const criticalCount = allItems.filter((item) => item.level === "critical").length
  const warningCount = allItems.filter((item) => item.level === "warning").length
  const safeCount = allItems.filter((item) => item.level === "safe").length

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
                Backup & restore.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Operational safety checklist for database backups, SQL changes,
                restores, payment incidents, and market resolution mistakes.
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
                href="/admin/production-checklist"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Production checklist
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
              Critical
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-red-700">
              {criticalCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Review
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-amber-700">
              {warningCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Safe
            </p>

            <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-700">
              {safeCount}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
          Do not launch Qwikeer with real users or real money until backup,
          restore, legal, payment reconciliation, and incident response plans are
          reviewed and tested.
        </section>

        <section className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                {section.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {section.description}
              </p>

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
                        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${levelClass(
                          item.level
                        )}`}
                      >
                        {levelLabel(item.level)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Recommended emergency steps
          </h2>

          <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              <strong>1.</strong> Pause affected feature: trading, deposits,
              withdrawals, or market resolution.
            </p>

            <p>
              <strong>2.</strong> Preserve evidence: audit logs, ledger entries,
              API errors, screenshots, and affected user IDs.
            </p>

            <p>
              <strong>3.</strong> Do not manually edit wallet balances.
            </p>

            <p>
              <strong>4.</strong> Identify affected users, markets, orders,
              trades, money requests, and ledger entries.
            </p>

            <p>
              <strong>5.</strong> Create a correction plan and test it on a copy
              of the database before production.
            </p>

            <p>
              <strong>6.</strong> Communicate clearly with users if real balances
              or withdrawals are affected.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}