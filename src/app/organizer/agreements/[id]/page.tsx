import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  FileSignature,
  History,
  Receipt,
  Wallet,
} from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import {
  getAgreementForOrganizer,
  harareTodayKey,
  invoiceBalanceStatus,
  listAgreementInvoices,
  listAgreementPayments,
  listAgreementVersions,
} from "@/lib/agreements";
import {
  AGREEMENT_STATUS_LABEL,
  AGREEMENT_VERSION_STATUS_LABEL,
  INVOICE_PAYMENT_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatCivilDate,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyExact,
  statusTone,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { AgreementForm } from "@/components/agreement-form";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { PaymentActions } from "@/components/payment-actions";
import { SendAgreementButton } from "@/components/send-agreement-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agreement · Organizer" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/agreements", label: "Agreements" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

const TERM_SECTIONS: Array<{
  key:
    | "cancellation_terms"
    | "transport_arrangements"
    | "accommodation_arrangements"
    | "technical_requirements"
    | "responsibilities"
    | "additional_conditions";
  label: string;
}> = [
  { key: "cancellation_terms", label: "Cancellation and postponement" },
  { key: "transport_arrangements", label: "Transport" },
  { key: "accommodation_arrangements", label: "Accommodation" },
  { key: "technical_requirements", label: "Technical requirements" },
  { key: "responsibilities", label: "Responsibilities" },
  { key: "additional_conditions", label: "Additional conditions" },
];

export default async function OrganizerAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireApprovedOrganizer();
  const { id } = await params;
  const agreement = getAgreementForOrganizer(id, user.id);
  if (!agreement) notFound();

  const versions = listAgreementVersions(agreement.id);
  const payments = listAgreementPayments(agreement.id);
  const invoices = listAgreementInvoices(agreement.id);
  const today = harareTodayKey();

  const acceptedVersion = versions.find((version) => version.status === "accepted");
  const current =
    versions.find((version) => version.version === agreement.current_version) ?? versions[0];
  if (!current) notFound();

  const feeCents = acceptedVersion?.fee_cents ?? current.fee_cents;
  const feeCurrency = acceptedVersion?.currency ?? current.currency;
  const receivedCents = payments
    .filter((payment) => payment.status === "received")
    .reduce((total, payment) => total + payment.amount_cents, 0);
  const recordedCents = payments
    .filter((payment) => payment.status === "recorded")
    .reduce((total, payment) => total + payment.amount_cents, 0);
  const outstandingCents = Math.max(0, feeCents - receivedCents);
  const remainingCents = Math.max(0, feeCents - receivedCents - recordedCents);

  const openInvoices = invoices
    .filter((invoice) => invoice.status === "issued")
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      balanceCents: invoice.amount_cents - invoice.received_cents,
    }))
    .filter((invoice) => invoice.balanceCents > 0);

  const isAmendmentDraft = !!acceptedVersion && current.status !== "accepted";
  const formMode = current.status === "draft" || current.status === "changes_requested"
    ? isAmendmentDraft
      ? "amend"
      : "edit"
    : null;
  const initial = {
    feeCents: current.fee_cents,
    depositCents: current.deposit_cents,
    depositDueOn: current.deposit_due_on,
    balanceDueOn: current.balance_due_on,
    cancellationTerms: current.cancellation_terms,
    transportArrangements: current.transport_arrangements,
    accommodationArrangements: current.accommodation_arrangements,
    technicalRequirements: current.technical_requirements,
    responsibilities: current.responsibilities,
    additionalConditions: current.additional_conditions,
  };

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow={`Agreement · version ${agreement.current_version}`}
        title={`${agreement.artist_stage_name} — ${agreement.event_title}`}
        description={`${formatDate(agreement.event_starts_at)} · ${agreement.event_venue}`}
        tabs={tabs}
        actions={
          <Link href="/organizer/agreements" className="btn btn-outline btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> All agreements
          </Link>
        }
      />

      <div className="container-page max-w-5xl space-y-4 pt-6">
        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${statusTone(agreement.status)}`}>
              {AGREEMENT_STATUS_LABEL[agreement.status] || agreement.status}
            </span>
            <span className="text-[11px] text-ink-400">
              Updated {formatDateTime(agreement.updated_at)}
            </span>
            {agreement.booking_status === "cancelled" ? (
              <span className="badge bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                Booking cancelled
              </span>
            ) : null}
          </div>

          {current.change_summary ? (
            <p className="mt-2 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-600">
              <strong>Change in this version:</strong> {current.change_summary}
            </p>
          ) : null}
          {current.response_note ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-800">
              <strong>Artist requested changes:</strong> {current.response_note}
            </p>
          ) : null}
          {agreement.current_status === "sent" ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11.5px] text-amber-800">
              Waiting for {agreement.artist_stage_name} to accept this version. Sent versions cannot
              be edited.
            </p>
          ) : null}
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              {acceptedVersion ? "Agreed fee" : "Draft fee"}
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">
              {formatMoneyExact(feeCents, feeCurrency)}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
              {acceptedVersion ? `Accepted version ${acceptedVersion.version}.` : "Not contracted yet."}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Deposit
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">
              {formatMoneyExact(current.deposit_cents, feeCurrency)}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
              {current.deposit_cents > 0
                ? `Due ${formatCivilDate(current.deposit_due_on)}`
                : "No deposit set."}
              {current.balance_due_on
                ? ` · Balance due ${formatCivilDate(current.balance_due_on)}`
                : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Confirmed received
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">
              {formatMoneyExact(receivedCents, feeCurrency)}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
              {recordedCents > 0
                ? `${formatMoney(recordedCents, feeCurrency)} awaiting the artist's confirmation.`
                : "Only artist-confirmed payments count."}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Outstanding
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">
              {formatMoneyExact(outstandingCents, feeCurrency)}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
              Agreed fee minus confirmed payments.
            </p>
          </div>
        </div>

        {formMode ? (
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <FileSignature className="h-4 w-4 text-brand-600" />
              {isAmendmentDraft ? "Amend the agreement" : "Edit the draft"}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              {isAmendmentDraft
                ? "Saving creates a new version. The accepted version stays in force until the artist accepts the amendment."
                : "Drafts are private until you send them. Editing a draft replaces its current values."}
            </p>
            <div className="mt-4">
              <AgreementForm
                mode={formMode}
                agreementId={agreement.id}
                initial={initial}
              />
            </div>
            {current.status === "draft" ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-[11px] text-ink-500">
                  When this version is ready, send it to the artist for acceptance.
                </p>
                <SendAgreementButton agreementId={agreement.id} />
              </div>
            ) : null}
          </section>
        ) : null}

        {current.status !== "draft" ? (
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <FileSignature className="h-4 w-4 text-brand-600" /> Terms
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {TERM_SECTIONS.map((section) =>
                current[section.key] ? (
                  <div key={section.key} className="rounded-xl bg-surface/60 px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                      {section.label}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-ink-600">
                      {current[section.key]}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
            {TERM_SECTIONS.every((section) => !current[section.key]) ? (
              <p className="mt-3 text-[11.5px] text-ink-400">
                No additional terms were added to this version.
              </p>
            ) : null}

            {current.status === "accepted" ? (
              <details className="mt-4 border-t border-line pt-4">
                <summary className="cursor-pointer text-[12px] font-semibold text-brand-700">
                  Propose an amendment
                </summary>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                  Changes create a new version and require the artist&apos;s acceptance. The current
                  accepted version stays in force until then.
                </p>
                <div className="mt-3">
                  <AgreementForm mode="amend" agreementId={agreement.id} initial={initial} />
                </div>
              </details>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
            <Wallet className="h-4 w-4 text-brand-600" /> Payments
          </h2>
          <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
            Record payments you have made. They count towards the balance only after{" "}
            {agreement.artist_stage_name} confirms receipt. EventIQ does not process or hold this
            money.
          </p>

          {payments.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[700px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Invoice</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="text-[11.5px] text-ink-500">
                          {formatCivilDate(payment.paid_on)}
                        </td>
                        <td className="font-semibold">
                          {formatMoneyExact(payment.amount_cents, payment.currency)}
                        </td>
                        <td className="text-[11.5px] text-ink-500">
                          {PAYMENT_METHOD_LABEL[payment.method] || payment.method}
                        </td>
                        <td className="text-[11.5px] text-ink-500">{payment.reference || "—"}</td>
                        <td className="text-[11.5px] text-ink-500">
                          {payment.invoice_number || "—"}
                        </td>
                        <td>
                          <span className={`badge ${statusTone(payment.status)}`}>
                            {PAYMENT_STATUS_LABEL[payment.status] || payment.status}
                          </span>
                        </td>
                        <td>
                          {payment.status === "recorded" ? (
                            <PaymentActions
                              agreementId={agreement.id}
                              paymentId={payment.id}
                              role="organizer"
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line px-3.5 py-4 text-[11.5px] text-ink-400">
              No payments recorded yet.
            </p>
          )}

          {acceptedVersion ? (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-[12.5px] font-semibold text-ink-900">Record a payment</h3>
              <div className="mt-2">
                <RecordPaymentForm
                  agreementId={agreement.id}
                  today={today}
                  invoices={openInvoices}
                  remainingCents={remainingCents}
                />
              </div>
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-1.5 text-[10.5px] text-ink-400">
              <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" /> The artist must accept the
              agreement before payments can be recorded.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
            <Receipt className="h-4 w-4 text-brand-600" /> Invoices from the artist
          </h2>
          {invoices.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[680px]">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Issued</th>
                      <th>Due</th>
                      <th>Amount</th>
                      <th>Confirmed</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const state = invoiceBalanceStatus(invoice, today);
                      const balance = Math.max(0, invoice.amount_cents - invoice.received_cents);
                      return (
                        <tr key={invoice.id}>
                          <td className="font-semibold">{invoice.number}</td>
                          <td className="text-[11.5px] text-ink-500">
                            {formatCivilDate(invoice.issued_on)}
                          </td>
                          <td className="text-[11.5px] text-ink-500">
                            {formatCivilDate(invoice.due_on)}
                          </td>
                          <td>{formatMoneyExact(invoice.amount_cents, invoice.currency)}</td>
                          <td className="text-[11.5px] text-ink-500">
                            {formatMoney(invoice.received_cents, invoice.currency)}
                          </td>
                          <td className="text-[11.5px] text-ink-500">
                            {formatMoney(balance, invoice.currency)}
                          </td>
                          <td>
                            <span className={`badge ${statusTone(state)}`}>
                              {INVOICE_PAYMENT_LABEL[state] || state}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line px-3.5 py-4 text-[11.5px] text-ink-400">
              The artist has not issued an invoice yet.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
            <History className="h-4 w-4 text-ink-400" /> Version history
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <div className="hide-scrollbar overflow-x-auto">
              <table className="table-base min-w-[640px]">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Fee</th>
                    <th>Sent</th>
                    <th>Artist response</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version) => (
                    <tr key={version.id}>
                      <td className="font-semibold">v{version.version}</td>
                      <td>
                        <span className={`badge ${statusTone(version.status)}`}>
                          {AGREEMENT_VERSION_STATUS_LABEL[version.status] || version.status}
                        </span>
                      </td>
                      <td>{formatMoneyExact(version.fee_cents, version.currency)}</td>
                      <td className="text-[11px] text-ink-500">
                        {version.sent_at ? formatDateTime(version.sent_at) : "—"}
                      </td>
                      <td className="text-[11px] text-ink-500">
                        {version.responded_at ? formatDateTime(version.responded_at) : "—"}
                      </td>
                      <td className="max-w-[240px] text-[11px] text-ink-500">
                        {version.change_summary ? <span>{version.change_summary}</span> : null}
                        {version.response_note ? (
                          <span className="block text-amber-700">
                            Artist note: {version.response_note}
                          </span>
                        ) : null}
                        {!version.change_summary && !version.response_note ? "—" : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
