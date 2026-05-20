import Link from "next/link"

/**
 * Qwikeer Privacy Policy
 *
 * Starter privacy page.
 * This is not final legal advice.
 */

export default function PrivacyPage() {
  return (
    <main className="p-6">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
          Qwikeer Legal
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950 md:text-6xl">
          Privacy Policy
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          This Privacy Policy explains the types of information Qwikeer may
          collect and how that information may be used to operate the platform.
          This draft should be reviewed before launch.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              1. Information We Collect
            </h2>
            <p className="mt-2">
              Qwikeer may collect account information such as email address,
              user ID, authentication records, wallet activity, deposits,
              withdrawals, trading activity, ledger records, and support
              messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              2. Verification Information
            </h2>
            <p className="mt-2">
              If Qwikeer enables KYC or compliance checks, we may collect
              identity documents, date of birth, address information, phone
              number, source-of-funds details, or other information required for
              legal and regulatory compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              3. How We Use Information
            </h2>
            <p className="mt-2">
              Information may be used to operate user accounts, secure the
              platform, process deposits and withdrawals, resolve markets,
              prevent fraud, comply with law, improve services, and respond to
              support requests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              4. Trading and Ledger Records
            </h2>
            <p className="mt-2">
              Qwikeer keeps records of orders, trades, positions, wallet
              movements, and ledger entries. These records are important for
              account accuracy, dispute handling, audits, and market integrity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              5. Sharing Information
            </h2>
            <p className="mt-2">
              Qwikeer may share information with service providers, payment
              processors, compliance partners, regulators, law enforcement, or
              other parties where required to operate the platform or comply
              with law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              6. Security
            </h2>
            <p className="mt-2">
              Qwikeer aims to protect user information using technical,
              operational, and administrative safeguards. However, no system can
              guarantee perfect security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              7. Data Retention
            </h2>
            <p className="mt-2">
              Qwikeer may retain account, transaction, and compliance records
              for as long as necessary to operate the platform, resolve
              disputes, comply with legal obligations, and maintain audit
              history.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              8. User Choices
            </h2>
            <p className="mt-2">
              Depending on applicable law, users may have rights to access,
              correct, delete, or restrict the use of certain personal
              information. Some records may need to be retained for legal,
              compliance, or security reasons.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              9. Contact
            </h2>
            <p className="mt-2">
              For privacy questions, contact the Qwikeer support team using the
              Help page.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/terms"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Terms of Use
          </Link>

          <Link
            href="/responsible-trading"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Responsible Trading
          </Link>
        </div>
      </section>
    </main>
  )
}