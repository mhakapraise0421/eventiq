import type { Metadata } from "next";
import { Download, TrendingUp, Wallet } from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import { getOrganizerEventBreakdown, getOrganizerStats, getMonthlySales } from "@/lib/stats";
import { formatDate, formatMoney, formatMoneyExact, percent } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { StatCard, MoneyStat } from "@/components/stat-card";
import { BarChart, ProgressBar } from "@/components/charts";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

export default async function OrganizerReportsPage() {
  const { user, profile } = await requireApprovedOrganizer();
  const stats = getOrganizerStats(user.id);
  const monthly = getMonthlySales(user.id);
  const breakdown = getOrganizerEventBreakdown(user.id);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow={`${profile.business_name} · Reports`}
        title="Sales & attendance"
        description="Track gross sales, platform fees and payout estimates across every event."
        tabs={tabs}
        actions={
          <a href="/api/reports/sales" className="btn btn-primary btn-sm">
            <Download className="h-3.5 w-3.5" /> Export all sales (CSV)
          </a>
        }
      />

      <div className="container-page max-w-5xl pt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyStat
            label="Gross sales"
            cents={stats.grossCents}
            hint={`${stats.ordersCount} paid orders`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MoneyStat
            label="Service fees"
            cents={stats.feeCents}
            hint="Collected from attendees"
          />
          <MoneyStat
            label="Commission"
            cents={stats.commissionCents}
            hint="8% platform commission"
          />
          <MoneyStat
            label="Estimated payout"
            cents={stats.netToOrganizerCents}
            hint="After commission and refunds"
            icon={<Wallet className="h-4 w-4" />}
            tone="brand"
          />
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                Monthly gross sales
              </h2>
              <p className="mt-1 text-[11px] text-ink-400">
                Ticket value before the EventIQ commission. Last 6 months.
              </p>
            </div>
            <span className="badge bg-surface text-ink-500">
              {monthly.reduce((sum, row) => sum + row.orders, 0)} paid orders
            </span>
          </div>
          <div className="mt-5">
            <BarChart data={monthly} valueKey="gross" labelKey="label" height={200} />
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
              Event breakdown
            </h2>
            <a href="/api/reports/sales" className="text-[11.5px] font-semibold text-brand-700">
              Download full ledger
            </a>
          </div>
          {breakdown.length ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Orders</th>
                      <th>Tickets</th>
                      <th>Admitted</th>
                      <th>Gross</th>
                      <th className="text-right">Export</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row) => (
                      <tr key={row.id}>
                        <td className="font-semibold text-ink-950">{row.title}</td>
                        <td className="text-[11.5px] text-ink-500">
                          {formatDate(row.starts_at)}
                        </td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>{row.orders}</td>
                        <td>{row.tickets}</td>
                        <td>
                          <div className="flex min-w-[90px] items-center gap-2">
                            <ProgressBar
                              value={row.admitted}
                              max={row.tickets || 1}
                              tone="emerald"
                            />
                            <span className="text-[10.5px] text-ink-400">
                              {percent(row.admitted, row.tickets)}%
                            </span>
                          </div>
                        </td>
                        <td className="font-semibold">{formatMoney(row.gross)}</td>
                        <td className="text-right">
                          <a
                            href={`/api/reports/sales?eventId=${row.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                          >
                            <Download className="h-3 w-3" /> CSV
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-line bg-white px-4 py-6 text-center text-[11.5px] text-ink-400">
              No sales data yet. Publish an event to start collecting reports.
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Tickets sold
            </p>
            <p className="mt-1.5 font-display text-[22px] font-semibold">{stats.ticketsSold}</p>
            <p className="mt-1 text-[10.5px] text-ink-400">{stats.admitted} admitted at the gate</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Refunded
            </p>
            <p className="mt-1.5 font-display text-[22px] font-semibold">
              {formatMoneyExact(stats.refundedCents)}
            </p>
            <p className="mt-1 text-[10.5px] text-ink-400">Deducted from payout estimate</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Commission rate
            </p>
            <p className="mt-1.5 font-display text-[22px] font-semibold">8%</p>
            <p className="mt-1 text-[10.5px] text-ink-400">Plus 5% attendee service fee</p>
          </div>
        </section>

        <p className="mt-4 text-[10.5px] leading-relaxed text-ink-400">
          Reports reflect paid orders only; pending and failed checkouts are excluded. Payout
          figures are estimates and may change after refunds or disputed payments. Export files
          include attendee details for operational use only.
        </p>
      </div>
    </div>
  );
}
