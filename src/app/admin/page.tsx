import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  ScanLine,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { getAdminStats, getMonthlyPlatformRevenue } from "@/lib/stats";
import {
  listOrganizerApplications,
  listPriceRequests,
} from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { listRecentOrdersForAdmin } from "@/lib/orders";
import { formatDateTime, formatMoney, formatMoneyExact } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { StatCard, MoneyStat } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { BarChart } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin console" };

export default async function AdminPage() {
  const user = await requireRolePage(["admin", "ceo"]);

  const stats = getAdminStats();
  const monthly = getMonthlyPlatformRevenue();
  const applications = listOrganizerApplications("all");
  const pendingApplications = applications.filter(
    (application) => application.status === "pending" || application.status === "requires_modification",
  );
  const pendingEvents = listEventsForAdmin("pending");
  const priceRequests = listPriceRequests("pending");
  const recentOrders = listRecentOrdersForAdmin().slice(0, 6);

  const tabs = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/organizers", label: "Organizers", count: pendingApplications.length },
    { href: "/admin/events", label: "Events", count: pendingEvents.length },
    { href: "/admin/price-requests", label: "Price requests", count: priceRequests.length },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/operations", label: "Operations" },
    { href: "/admin/audit", label: "Audit log" },
  ];

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow={`Governance console · ${user.role === "ceo" ? "CEO" : "Administrator"}`}
        title="Platform overview"
        description="Approvals, order exceptions, users and gate operations across EventIQ Zimbabwe."
        tabs={tabs}
        actions={
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10.5px] font-semibold text-ink-500">
            <ShieldCheck className="h-3 w-3 text-brand-600" /> Least-privilege access
          </span>
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
          <MoneyStat
            label="Platform commission"
            cents={stats.commissionCents}
            hint={`${formatMoneyExact(stats.feeCents)} attendee fees`}
            icon={<BadgeCheck className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Tickets issued"
            value={stats.ticketsIssued}
            hint={`${stats.admitted} admitted`}
            icon={<Ticket className="h-4 w-4" />}
          />
          <StatCard
            label="Scans today"
            value={stats.scansToday}
            hint="Across all events"
            icon={<ScanLine className="h-4 w-4" />}
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                  Platform revenue
                </h2>
                <p className="mt-1 text-[11px] text-ink-400">
                  Commission and gross ticket value by month.
                </p>
              </div>
              <span className="badge bg-surface text-ink-500">Last 6 months</span>
            </div>
            <div className="mt-5">
              <BarChart data={monthly} valueKey="commission" labelKey="label" height={190} />
            </div>
            <div className="mt-4 grid gap-2 border-t border-line pt-4 text-[11.5px] sm:grid-cols-3">
              <div>
                <p className="text-ink-400">Registered users</p>
                <p className="mt-0.5 font-semibold">{stats.usersCount}</p>
              </div>
              <div>
                <p className="text-ink-400">Pending organizers</p>
                <p className="mt-0.5 font-semibold">{stats.pendingOrganizers}</p>
              </div>
              <div>
                <p className="text-ink-400">Refunded</p>
                <p className="mt-0.5 font-semibold">{formatMoney(stats.refundedCents)}</p>
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                Approval queue
              </p>
              <div className="mt-3 space-y-1.5">
                {[
                  {
                    href: "/admin/organizers",
                    label: "Organizer applications",
                    value: pendingApplications.length,
                    icon: Users,
                  },
                  {
                    href: "/admin/events",
                    label: "Events awaiting review",
                    value: pendingEvents.length,
                    icon: CalendarDays,
                  },
                  {
                    href: "/admin/price-requests",
                    label: "Price change requests",
                    value: priceRequests.length,
                    icon: ClipboardList,
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-surface"
                  >
                    <span className="flex items-center gap-2 text-[12px] font-medium text-ink-700">
                      <item.icon className="h-3.5 w-3.5 text-brand-600" /> {item.label}
                    </span>
                    <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                      {item.value}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-ink-950 p-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">
                Governance
              </p>
              <p className="mt-2 font-display text-[14.5px] font-semibold">
                Every action is logged.
              </p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/50">
                Approvals, refunds, role changes, device assignments and suspensions are
                recorded with actor, timestamp and before/after values.
              </p>
              <Link
                href="/admin/audit"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-aqua-300"
              >
                Open audit log <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section>
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
                Organizer applications
              </h2>
              <Link href="/admin/organizers" className="text-[11.5px] font-semibold text-brand-700">
                Review all
              </Link>
            </div>
            {pendingApplications.length ? (
              <div className="mt-3 space-y-2">
                {pendingApplications.slice(0, 4).map((application) => (
                  <Link
                    key={application.user_id}
                    href="/admin/organizers"
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 hover:bg-surface/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-ink-950">
                        {application.business_name}
                      </p>
                      <p className="text-[10.5px] text-ink-400">
                        {application.user_name} · {application.city || "—"}
                      </p>
                    </div>
                    <StatusBadge status={application.status} kind="organizer" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-line bg-white px-4 py-6 text-center text-[11.5px] text-ink-400">
                No organizer applications waiting.
              </p>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
                Recent orders
              </h2>
              <Link href="/admin/orders" className="text-[11.5px] font-semibold text-brand-700">
                All orders
              </Link>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Event</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="font-mono text-[10.5px]">{order.reference}</td>
                      <td className="max-w-[160px] truncate text-[11.5px]">{order.event_title}</td>
                      <td className="font-semibold">{formatMoney(order.total_cents)}</td>
                      <td>
                        <StatusBadge status={order.status} kind="order" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-ink-400">
              Latest paid, pending and refunded orders.{" "}
              {recentOrders[0]
                ? `Last activity ${formatDateTime(recentOrders[0].created_at)}.`
                : ""}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
