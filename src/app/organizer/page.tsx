import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Plus,
  ScanLine,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { getOrganizerEventBreakdown, getOrganizerStats, getMonthlySales } from "@/lib/stats";
import { getOrganizerEventsByStatus, listOrganizerEvents } from "@/lib/events";
import { formatDate, formatMoney, formatMoneyExact, formatTime, percent } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { StatCard, MoneyStat } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar, BarChart } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organizer dashboard" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

export default async function OrganizerPage() {
  const user = await requireRolePage(["organizer", "admin", "ceo"]);
  const profile = getOrganizerProfile(user.id);

  if (!profile || profile.status !== "approved") {
    return (
      <div className="min-h-[70vh] bg-surface/40 pb-16">
        <ConsoleHeader
          eyebrow="Organizer console"
          title="Organizer access"
          description="Publish events, manage ticket inventory and track sales from one console."
          tabs={tabs}
        />
        <div className="container-page pt-6">
          {profile ? (
            <div className="rounded-2xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                    Application status
                  </p>
                  <p className="mt-1.5 font-display text-[20px] font-semibold">
                    {profile.business_name}
                  </p>
                </div>
                <StatusBadge status={profile.status} kind="organizer" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Submitted", done: true, text: formatDate(profile.created_at) },
                  {
                    label: "Under review",
                    done: profile.status === "pending",
                    text:
                      profile.status === "pending"
                        ? "Our team is reviewing your documents."
                        : "Review completed",
                  },
                  {
                    label: "Decision",
                    done: profile.status === "approved",
                    text:
                      profile.status === "approved"
                        ? "Publishing enabled"
                        : profile.status === "requires_modification"
                          ? "Changes required"
                          : profile.status === "rejected"
                            ? "Not approved"
                            : "Awaiting review",
                  },
                ].map((step, index) => (
                  <div
                    key={step.label}
                    className={`rounded-xl border p-3.5 ${
                      step.done ? "border-brand-200 bg-brand-50/60" : "border-line bg-surface/40"
                    }`}
                  >
                    <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-900">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          step.done ? "bg-brand-600 text-white" : "bg-white text-ink-400 ring-1 ring-line"
                        }`}
                      >
                        {index + 1}
                      </span>
                      {step.label}
                    </p>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>

              {profile.decision_note ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-800">
                  <strong>Reviewer note:</strong> {profile.decision_note}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/organizer/apply" className="btn btn-primary btn-sm">
                  {profile.status === "requires_modification"
                    ? "Update application"
                    : "View application"}
                </Link>
                <Link href="/policies/organizer-agreement" className="btn btn-outline btn-sm">
                  Organizer agreement
                </Link>
              </div>
              <p className="mt-4 text-[10.5px] text-ink-400">
                You can prepare events once approved. Applications are typically reviewed by
                the EventIQ team within two business days.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Apply to become an organizer"
              description="Tell us about your events and submit your business details. Once approved you can publish events and sell tickets."
              actionHref="/organizer/apply"
              actionLabel="Start application"
            />
          )}
        </div>
      </div>
    );
  }

  const stats = getOrganizerStats(user.id);
  const monthly = getMonthlySales(user.id);
  const breakdown = getOrganizerEventBreakdown(user.id);
  const events = listOrganizerEvents(user.id);
  const upcoming = getOrganizerEventsByStatus(user.id, ["approved"]);
  const drafts = events.filter((event) => ["draft", "rejected"].includes(event.status));
  const pending = events.filter((event) => event.status === "pending");

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow={`${profile.business_name} · Organizer console`}
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Track sales, manage inventory and keep every event moving toward the gate."
        tabs={tabs}
        actions={
          <Link href="/organizer/events/new" className="btn btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> Create event
          </Link>
        }
      />

      <div className="container-page pt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyStat
            label="Gross ticket sales"
            cents={stats.grossCents}
            hint={`${stats.ordersCount} paid orders`}
            icon={<CircleDollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Tickets sold"
            value={stats.ticketsSold}
            hint={`${stats.admitted} admitted at the gate`}
            icon={<Ticket className="h-4 w-4" />}
          />
          <StatCard
            label="Admission rate"
            value={`${percent(stats.admitted, stats.ticketsSold)}%`}
            hint="Scanned against issued tickets"
            icon={<ScanLine className="h-4 w-4" />}
          />
          <MoneyStat
            label="Net payout"
            cents={stats.netToOrganizerCents}
            hint="After 8% commission and refunds"
            icon={<TrendingUp className="h-4 w-4" />}
            tone="brand"
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                  Sales by month
                </h2>
                <p className="mt-1 text-[11px] text-ink-400">
                  Gross ticket value before platform commission.
                </p>
              </div>
              <Link
                href="/organizer/reports"
                className="flex items-center gap-1 text-[11.5px] font-semibold text-brand-700"
              >
                Full reports <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-5">
              <BarChart data={monthly} valueKey="gross" labelKey="label" height={190} />
            </div>
            <div className="mt-4 grid gap-2 border-t border-line pt-4 text-[11.5px] sm:grid-cols-3">
              <div>
                <p className="text-ink-400">Service fees collected</p>
                <p className="mt-0.5 font-semibold text-ink-950">
                  {formatMoneyExact(stats.feeCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-400">Platform commission</p>
                <p className="mt-0.5 font-semibold text-ink-950">
                  {formatMoneyExact(stats.commissionCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-400">Refunded</p>
                <p className="mt-0.5 font-semibold text-ink-950">
                  {formatMoneyExact(stats.refundedCents)}
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                Needs attention
              </p>
              <div className="mt-3 space-y-2">
                {[
                  {
                    label: "Draft events",
                    value: drafts.length,
                    href: "/organizer/events",
                    icon: CalendarDays,
                  },
                  {
                    label: "Pending approval",
                    value: pending.length,
                    href: "/organizer/events",
                    icon: Clock,
                  },
                  {
                    label: "Upcoming published",
                    value: upcoming.length,
                    href: "/organizer/events",
                    icon: BadgeCheck,
                  },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-surface"
                  >
                    <span className="flex items-center gap-2 text-[12px] font-medium text-ink-700">
                      <item.icon className="h-3.5 w-3.5 text-brand-600" /> {item.label}
                    </span>
                    <span className="text-[12px] font-semibold">{item.value}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-ink-950 p-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">
                Payouts
              </p>
              <p className="mt-2 font-display text-[22px] font-semibold">
                {formatMoney(stats.netToOrganizerCents)}
              </p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-white/50">
                Estimated settlement for completed sales after commission and refunds.
              </p>
              <Link
                href="/policies/organizer-agreement"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-aqua-300"
              >
                Settlement terms <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </div>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
              Event performance
            </h2>
            <Link
              href="/organizer/events"
              className="flex items-center gap-1 text-[11.5px] font-semibold text-brand-700"
            >
              Manage events <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {breakdown.length ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[680px]">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Tickets</th>
                      <th>Gross</th>
                      <th>Admitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.slice(0, 8).map((row) => (
                      <tr key={row.id} className="hover:bg-surface/40">
                        <td>
                          <Link
                            href={`/organizer/events/${row.id}`}
                            className="font-semibold text-ink-950 hover:text-brand-700"
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="text-[11.5px] text-ink-500">
                          {formatDate(row.starts_at)} · {formatTime(row.starts_at)}
                        </td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="font-semibold">{row.tickets}</td>
                        <td className="font-semibold">{formatMoney(row.gross)}</td>
                        <td>
                          <div className="flex min-w-[90px] items-center gap-2">
                            <ProgressBar value={row.admitted} max={row.tickets || 1} />
                            <span className="text-[10.5px] text-ink-400">
                              {percent(row.admitted, row.tickets)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Create your first event"
                description="Set up ticket types, publish after approval and watch sales arrive in real time."
                actionHref="/organizer/events/new"
                actionLabel="Create event"
              />
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              href: "/organizer/events/new",
              title: "Create an event",
              text: "Draft an event with ticket tiers and submit it for review.",
              icon: Plus,
            },
            {
              href: "/organizer/reports",
              title: "Download reports",
              text: "Export sales, fees and attendance data as CSV.",
              icon: TrendingUp,
            },
            {
              href: "/organizer/events",
              title: "Manage inventory",
              text: "Review capacity, price requests and admission progress.",
              icon: Users,
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-line bg-white p-4 transition hover:border-brand-200 hover:bg-brand-50/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <item.icon className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-[13px] font-semibold text-ink-950">{item.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{item.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
