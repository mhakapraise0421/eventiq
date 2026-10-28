import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  CalendarCheck,
  CircleAlert,
  Clock,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import {
  earningsSummary,
  harareTodayKey,
  invoiceBalanceStatus,
  listArtistInvoices,
  listArtistPayments,
  listCancelledEngagements,
} from "@/lib/agreements";
import {
  INVOICE_PAYMENT_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatCivilDate,
  formatDate,
  formatMoney,
  formatMoneyExact,
  statusTone,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Earnings" };

export default async function ArtistEarningsPage() {
  const { profile } = await requireArtistPage();
  const summary = earningsSummary(profile.user_id);
  const payments = listArtistPayments(profile.user_id);
  const invoices = listArtistInvoices(profile.user_id);
  const cancelled = listCancelledEngagements(profile.user_id);
  const today = harareTodayKey();
  const currency = summary.currency;

  const cards = [
    {
      label: "Contracted earnings",
      value: summary.contractedCents,
      note: "Agreed fees on accepted agreements for bookings that are still active.",
      icon: <BadgeDollarSign className="h-4 w-4 text-brand-600" />,
    },
    {
      label: "Payments received",
      value: summary.receivedCents,
      note: "Payments you have confirmed as received. Nothing else is counted as received.",
      icon: <Wallet className="h-4 w-4 text-emerald-600" />,
    },
    {
      label: "Awaiting your confirmation",
      value: summary.recordedCents,
      note: "Payments an organizer recorded. They are not received until you confirm them.",
      icon: <Clock className="h-4 w-4 text-amber-600" />,
    },
    {
      label: "Outstanding",
      value: summary.outstandingCents,
      note: "Contracted fees minus confirmed payments across active bookings.",
      icon: <TrendingUp className="h-4 w-4 text-sky-600" />,
    },
    {
      label: "Overdue",
      value: summary.overdueCents,
      note: "Unpaid invoice balances past their due date.",
      icon: <CircleAlert className="h-4 w-4 text-rose-600" />,
    },
    {
      label: "Upcoming expected",
      value: summary.upcomingCents,
      note: "Unpaid invoice balances with a due date still ahead.",
      icon: <CalendarCheck className="h-4 w-4 text-ink-500" />,
    },
  ];

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Earnings"
        description="Contracted fees, confirmed payments and open balances, separated so nothing is overclaimed."
        tabs={artistTabs}
        actions={
          <Link href="/artist/agreements" className="btn btn-outline btn-sm">
            Agreements
          </Link>
        }
      />

      <div className="container-page max-w-5xl space-y-5 pt-6">
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-[11px] leading-relaxed text-ink-500">
          Figures come from accepted agreement versions, payments recorded against them and issued
          invoices. A proposed booking fee is never counted. EventIQ does not process artist payments
          or hold funds. Amounts are calculated on the server in cents and this is not a profit
          figure — expenses are not tracked yet.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-line bg-white p-4">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                {card.icon} {card.label}
              </p>
              <p className="mt-1.5 font-display text-[22px] font-semibold text-ink-950">
                {formatMoneyExact(card.value, currency)}
              </p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">{card.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Completed performances
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">
              {summary.completedPerformances}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
              Confirmed bookings whose event date has passed.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Cancelled engagements
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">
              {summary.cancelledEngagements}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
              {summary.cancelledReceivedCents > 0
                ? `${formatMoney(summary.cancelledReceivedCents, currency)} of confirmed payments remain recorded.`
                : "No confirmed payments attached to cancelled bookings."}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Agreements and invoices
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">
              {summary.agreementCount} · {summary.invoiceCount}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
              Agreements on record and open (non-void) invoices.
            </p>
          </div>
        </div>

        {summary.overpaidCents > 0 ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-800">
            Confirmed payments exceed the agreed fee by{" "}
            {formatMoneyExact(summary.overpaidCents, currency)} on at least one booking. It is shown
            separately rather than reducing another booking&apos;s balance.
          </p>
        ) : null}

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
            <Receipt className="h-4 w-4 text-brand-600" /> Invoices
          </h2>
          {invoices.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Event</th>
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
                          <td className="max-w-[220px] truncate text-[11.5px] text-ink-500">
                            {invoice.event_title || "—"}
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
              No invoices yet. Open an accepted agreement to issue one.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
            <Wallet className="h-4 w-4 text-brand-600" /> Payment history
          </h2>
          {payments.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[680px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="text-[11.5px] text-ink-500">
                          {formatCivilDate(payment.paid_on)}
                        </td>
                        <td className="max-w-[220px] truncate text-[11.5px] text-ink-500">
                          {payment.event_title || "—"}
                        </td>
                        <td className="font-semibold">
                          {formatMoneyExact(payment.amount_cents, payment.currency)}
                        </td>
                        <td className="text-[11.5px] text-ink-500">
                          {PAYMENT_METHOD_LABEL[payment.method] || payment.method}
                        </td>
                        <td className="text-[11.5px] text-ink-500">{payment.reference || "—"}</td>
                        <td>
                          <span className={`badge ${statusTone(payment.status)}`}>
                            {PAYMENT_STATUS_LABEL[payment.status] || payment.status}
                          </span>
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
        </section>

        {cancelled.length ? (
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <CircleAlert className="h-4 w-4 text-rose-500" /> Cancelled engagements
            </h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[560px]">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Agreed fee</th>
                      <th>Confirmed received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelled.map((entry) => (
                      <tr key={entry.booking_id}>
                        <td className="font-semibold">{entry.event_title}</td>
                        <td className="text-[11.5px] text-ink-500">
                          {formatDate(entry.event_starts_at)}
                        </td>
                        <td className="max-w-[220px] text-[11px] text-ink-500">
                          {entry.response_note || "—"}
                        </td>
                        <td className="text-[11.5px] text-ink-500">
                          {entry.accepted_fee_cents === null
                            ? "—"
                            : formatMoneyExact(entry.accepted_fee_cents, currency)}
                        </td>
                        <td className="text-[11.5px] text-ink-500">
                          {formatMoney(entry.received_cents, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
              Cancelled bookings are excluded from contracted earnings and outstanding balances.
              Confirmed payments already received stay on record.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
