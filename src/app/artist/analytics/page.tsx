import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarCheck,
  ChartColumnBig,
  CircleAlert,
  Clock,
  Handshake,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import {
  computeArtistAnalytics,
  resolveAnalyticsPeriod,
  type MetricComparison,
} from "@/lib/artist-analytics";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatCivilDate,
  formatMoney,
  formatMoneyExact,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { BarChart } from "@/components/charts";
import { MoneyStat } from "@/components/stat-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

const PRESETS = [
  { value: "current_month", label: "This month" },
  { value: "previous_month", label: "Last month" },
  { value: "current_quarter", label: "This quarter" },
  { value: "current_year", label: "This year" },
  { value: "previous_year", label: "Last year" },
  { value: "last_12_months", label: "Last 12 months" },
] as const;

function comparisonText(comparison: MetricComparison) {
  if (comparison.status === "no_activity") return "No earnings in either period.";
  if (comparison.status === "no_prior") return "No earnings in the comparison period, so no percentage is shown.";
  if (comparison.changePct === 0) return "No change from the comparison period.";
  return `${comparison.changePct! > 0 ? "+" : ""}${comparison.changePct}% vs the comparison period.`;
}

function ComparisonNote({ comparison }: { comparison: MetricComparison }) {
  const positive = comparison.status === "up";
  const negative = comparison.status === "down";
  return (
    <p
      className={`mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed ${
        positive ? "text-emerald-700" : negative ? "text-rose-700" : "text-ink-400"
      }`}
    >
      {positive ? (
        <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" />
      ) : negative ? (
        <ArrowDownRight className="mt-0.5 h-3 w-3 shrink-0" />
      ) : (
        <ChartColumnBig className="mt-0.5 h-3 w-3 shrink-0" />
      )}
      <span>{comparisonText(comparison)}</span>
    </p>
  );
}

export default async function ArtistAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { profile } = await requireArtistPage();
  const params = await searchParams;

  const resolved = resolveAnalyticsPeriod(params.period, params.from, params.to);
  const fallback = resolveAnalyticsPeriod("current_month");
  const error = resolved.ok ? null : resolved.error;
  const range = resolved.ok
    ? resolved.range
    : fallback.ok
      ? fallback.range
      : { start: "", end: "" };
  const analytics = computeArtistAnalytics(profile.user_id, range);
  const activePeriod = resolved.ok ? params.period || "current_month" : "current_month";
  const summary = analytics.totals;
  const bookings = analytics.bookings;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Analytics"
        description="Contracted fees and confirmed payments, compared across periods and calculated from your own records."
        tabs={artistTabs}
        actions={
          <>
            <Link href="/artist/earnings" className="btn btn-outline btn-sm">
              Earnings
            </Link>
            <Link href="/artist/reports" className="btn btn-primary btn-sm">
              Download a report
            </Link>
          </>
        }
      />

      <div className="container-page max-w-5xl space-y-4 pt-6">
        {error ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] text-amber-800">
            {error} Showing the current month instead.
          </p>
        ) : null}

        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((preset) => (
              <Link
                key={preset.value}
                href={`/artist/analytics?period=${preset.value}`}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                  activePeriod === preset.value
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {preset.label}
              </Link>
            ))}
          </div>
          <form method="get" action="/artist/analytics" className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="period" value="custom" />
            <label className="block">
              <span className="label">From</span>
              <input
                type="date"
                name="from"
                defaultValue={params.period === "custom" ? params.from || "" : analytics.range.start}
                className="input w-[150px]"
                required
              />
            </label>
            <label className="block">
              <span className="label">To</span>
              <input
                type="date"
                name="to"
                defaultValue={params.period === "custom" ? params.to || "" : analytics.range.end}
                className="input w-[150px]"
                required
              />
            </label>
            <button
              type="submit"
              className={`btn btn-sm ${
                activePeriod === "custom" ? "btn-primary" : "btn-outline"
              }`}
            >
              Apply range
            </button>
            <span className="ml-auto text-[11px] text-ink-400">
              Showing{" "}
              <strong className="font-semibold text-ink-600">
                {formatCivilDate(analytics.range.start)} – {formatCivilDate(analytics.range.end)}
              </strong>{" "}
              · compared with {formatCivilDate(analytics.previousRange.start)} –{" "}
              {formatCivilDate(analytics.previousRange.end)}
            </span>
          </form>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <MoneyStat
              label="Contracted earnings"
              cents={summary.contractedCents}
              hint="Accepted agreements for events in this period."
              icon={<BadgeDollarSign className="h-4 w-4" />}
              tone="brand"
            />
            <ComparisonNote comparison={analytics.comparisons.contracted} />
          </div>
          <div>
            <MoneyStat
              label="Payments received"
              cents={summary.receivedCents}
              hint="Only payments you confirmed as received."
              icon={<Wallet className="h-4 w-4" />}
            />
            <ComparisonNote comparison={analytics.comparisons.received} />
          </div>
          <MoneyStat
            label="Outstanding"
            cents={summary.outstandingCents}
            hint="Agreed fees minus confirmed payments, as at now."
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MoneyStat
            label="Overdue"
            cents={summary.overdueCents}
            hint="Open invoice balances due in this period and past due."
            icon={<CircleAlert className="h-4 w-4" />}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink-950">
                  Contracted earnings by month
                </h2>
                <p className="mt-1 text-[11px] text-ink-400">
                  Agreed fees grouped by event date, excluding cancelled engagements.
                </p>
              </div>
              <span className="badge bg-surface text-ink-500">{analytics.months.length} mo</span>
            </div>
            <div className="mt-5">
              <BarChart
                data={analytics.months.map((month) => ({
                  label: month.label,
                  value: month.contractedCents,
                }))}
                height={190}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink-950">
                  Payments received by month
                </h2>
                <p className="mt-1 text-[11px] text-ink-400">
                  Confirmed payments grouped by the date the money was paid.
                </p>
              </div>
              <span className="badge bg-surface text-ink-500">
                {formatMoney(summary.recordedCents)} awaiting
              </span>
            </div>
            <div className="mt-5">
              <BarChart
                data={analytics.months.map((month) => ({
                  label: month.label,
                  value: month.receivedCents,
                }))}
                height={190}
              />
            </div>
          </section>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-[15px] font-semibold text-ink-950">
              Monthly breakdown
            </h2>
            <p className="mt-1 text-[11px] text-ink-400">
              Contracted and received amounts can differ because contracts and cash fall in
              different months.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Contracted</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.months.map((month) => (
                    <tr key={month.key}>
                      <td className="font-semibold text-ink-950">{month.label}</td>
                      <td className="text-right">{formatMoneyExact(month.contractedCents)}</td>
                      <td className="text-right">{formatMoneyExact(month.receivedCents)}</td>
                      <td
                        className={`text-right ${
                          month.receivedCents - month.contractedCents < 0
                            ? "text-ink-400"
                            : "text-emerald-700"
                        }`}
                      >
                        {formatMoneyExact(month.receivedCents - month.contractedCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-[15px] font-semibold text-ink-950">
              Highest-earning months
            </h2>
            <p className="mt-1 text-[11px] text-ink-400">
              Ranked by contracted earnings within the selected period.
            </p>
            {analytics.topMonths.length ? (
              <ol className="mt-3 space-y-2">
                {analytics.topMonths.map((month, index) => (
                  <li
                    key={month.key}
                    className="flex items-center justify-between rounded-xl border border-line bg-surface/50 px-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                        {index + 1}
                      </span>
                      {month.label}
                    </span>
                    <span className="text-[11.5px] font-semibold text-ink-950">
                      {formatMoneyExact(month.contractedCents)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11px] text-ink-400">
                No contracted earnings in this period.
              </p>
            )}
            <div className="mt-4 rounded-xl bg-surface/60 px-3 py-2.5 text-[10.5px] leading-relaxed text-ink-400">
              {summary.overpaidCents > 0
                ? `Confirmed payments exceed agreed fees by ${formatMoneyExact(summary.overpaidCents)} across some engagements. Check those agreements.`
                : "No engagement has been paid more than its agreed fee."}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink-950">
                Booking activity
              </h2>
              <p className="mt-1 text-[11px] text-ink-400">
                Bookings whose event date falls inside the selected period.
              </p>
            </div>
            <Handshake className="h-4 w-4 text-brand-600" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Requests",
                value: bookings.totalRequests,
                note: `${bookings.requested} still awaiting your response`,
              },
              {
                label: "Confirmed",
                value: bookings.confirmed,
                note: `${bookings.completed} of these have been completed`,
              },
              {
                label: "Completed performances",
                value: bookings.completed,
                note: `${bookings.performancesPerMonth} per month on average`,
              },
              {
                label: "Cancelled",
                value: bookings.cancelled,
                note: `${bookings.declined} declined · ${bookings.withdrawn} withdrawn`,
              },
              {
                label: "Acceptance rate",
                value: bookings.acceptanceRatePct === null ? "—" : `${bookings.acceptanceRatePct}%`,
                note:
                  bookings.acceptanceRatePct === null
                    ? "No accepted or declined requests yet"
                    : "Accepted or cancelled ÷ decided requests",
              },
              {
                label: "Completion rate",
                value: bookings.conversionRatePct === null ? "—" : `${bookings.conversionRatePct}%`,
                note: "Completed performances ÷ requests in period",
              },
              {
                label: "Average agreed fee",
                value:
                  bookings.averageFeePerCompletedCents === null
                    ? "—"
                    : formatMoney(bookings.averageFeePerCompletedCents),
                note: "Per completed performance",
              },
              {
                label: "Performance frequency",
                value: `${bookings.performancesPerMonth}/mo`,
                note: "Completed performances per month",
              },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-line bg-surface/40 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  {metric.label}
                </p>
                <p className="mt-1 font-display text-[19px] font-semibold text-ink-950">
                  {metric.value}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">{metric.note}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-[15px] font-semibold text-ink-950">
              Payment status in period
            </h2>
            <p className="mt-1 text-[11px] text-ink-400">
              Every payment record dated inside the period, by status.
            </p>
            <div className="mt-3 space-y-2">
              {analytics.paymentsByStatus.length ? (
                analytics.paymentsByStatus.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-[11.5px] text-ink-600">
                      <Clock className="h-3.5 w-3.5 text-ink-300" />
                      {PAYMENT_STATUS_LABEL[row.key] || row.key}
                    </span>
                    <span className="text-[11.5px] font-semibold text-ink-950">
                      {row.count} · {formatMoneyExact(row.amountCents)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-[11px] text-ink-400">
                  No payment records in this period.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-[15px] font-semibold text-ink-950">
              Confirmed payments by method
            </h2>
            <p className="mt-1 text-[11px] text-ink-400">
              Only payments you confirmed as received are included.
            </p>
            <div className="mt-3 space-y-2">
              {analytics.paymentsByMethod.length ? (
                analytics.paymentsByMethod.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-[11.5px] text-ink-600">
                      <Receipt className="h-3.5 w-3.5 text-ink-300" />
                      {PAYMENT_METHOD_LABEL[row.key] || row.key}
                    </span>
                    <span className="text-[11.5px] font-semibold text-ink-950">
                      {row.count} · {formatMoneyExact(row.amountCents)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-[11px] text-ink-400">
                  No confirmed payments in this period.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink-950">
                <CalendarCheck className="h-4 w-4 text-brand-600" /> Report this period
              </h2>
              <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-400">
                Generate a private PDF for this period with the same server-calculated figures.
                Reports keep their own ID and are never replaced.
              </p>
            </div>
            <Link href="/artist/reports" className="btn btn-primary btn-sm">
              Open reports <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface/60 p-4 text-[10.5px] leading-relaxed text-ink-400">
          <p>
            Contracted earnings are agreed fees on accepted agreements, grouped by event date and
            excluding cancelled engagements. Proposed booking fees are never counted. Payments are
            counted only after you confirm them. Outstanding and overdue figures reflect the
            records at the moment this page loaded. All figures are calculated on the server from
            your own records.
          </p>
          <p className="mt-1.5">
            This page does not show profit: EventIQ does not yet track your expenses, so gross
            earnings are never labelled as profit. Compared periods use the same length immediately
            before the selected range; when that period has no earnings, no percentage is shown
            rather than a misleading number.
          </p>
        </section>
      </div>
    </div>
  );
}
