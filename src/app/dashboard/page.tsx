import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  QrCode,
  Receipt,
  ShieldCheck,
  Ticket as TicketIcon,
  UserRound,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserTickets, listOrdersForUser, releaseExpiredOrders } from "@/lib/orders";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatTimeRange,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { StatCard, MoneyStat } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account" };

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tickets", label: "My tickets" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;
  releaseExpiredOrders();

  const tickets = getUserTickets(user.id);
  const orders = listOrdersForUser(user.id);
  const now = Date.now();

  const upcoming = tickets.filter(
    (ticket) =>
      ticket.status === "valid" && new Date(ticket.event_starts_at || 0).getTime() >= now,
  );
  const uniqueUpcomingEvents = new Set(upcoming.map((ticket) => ticket.event_id)).size;
  const paidOrders = orders.filter(
    (order) => order.status === "paid" || order.status === "partially_refunded",
  );
  const totalSpent = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);

  const nextTicket = upcoming[0];
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Attendee account"
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Your upcoming events, tickets, orders and account settings in one place."
        tabs={tabs}
      />

      <div className="container-page pt-6">
        {denied ? (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700">
            <ShieldCheck className="h-4 w-4" /> That area is not available for your account
            role.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Upcoming events"
            value={uniqueUpcomingEvents}
            hint="Events you are going to"
            icon={<CalendarDays className="h-4 w-4" />}
          />
          <StatCard
            label="Live tickets"
            value={upcoming.length}
            hint="Valid for one admission each"
            icon={<TicketIcon className="h-4 w-4" />}
          />
          <StatCard
            label="Orders placed"
            value={orders.length}
            hint={`${paidOrders.length} completed`}
            icon={<Receipt className="h-4 w-4" />}
          />
          <MoneyStat
            label="Total paid"
            cents={totalSpent}
            hint="Across all completed orders"
            icon={<Wallet className="h-4 w-4" />}
            tone="brand"
          />
        </div>

        {nextTicket ? (
          <section className="mt-7">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-[19px] font-semibold tracking-[-0.025em]">
                Your next event
              </h2>
              <Link
                href="/dashboard/tickets"
                className="flex items-center gap-1 text-[12px] font-semibold text-brand-700"
              >
                All tickets <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              <div className="grid md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="relative h-40 md:h-full md:min-h-[176px]">
                  {nextTicket.cover_image ? (
                    <Image
                      src={nextTicket.cover_image}
                      alt={nextTicket.event_title || "Event"}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 240px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-brand-100 via-surface to-aqua-300/40" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:bg-gradient-to-r" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    {nextTicket.ticket_type_name}
                  </span>
                </div>
                <div className="flex flex-col justify-between gap-4 p-5">
                  <div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-ink-400">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
                        {formatDate(nextTicket.event_starts_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-brand-600" />
                        {formatTimeRange(nextTicket.event_starts_at, nextTicket.event_ends_at)} CAT
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-brand-600" />
                        {nextTicket.venue}, {nextTicket.city}
                      </span>
                    </p>
                    <p className="mt-2 font-display text-[21px] font-semibold leading-tight tracking-[-0.03em]">
                      {nextTicket.event_title}
                    </p>
                    <p className="mt-1 text-[11.5px] text-ink-400">
                      Ticket holder · {nextTicket.holder_name} · {nextTicket.code}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/tickets/${nextTicket.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Show ticket
                    </Link>
                    <Link
                      href={`/events/${nextTicket.event_slug}`}
                      className="btn btn-outline btn-sm"
                    >
                      Event details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-[19px] font-semibold tracking-[-0.025em]">
                Recent orders
              </h2>
              <Link
                href="/dashboard/orders"
                className="flex items-center gap-1 text-[12px] font-semibold text-brand-700"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {recentOrders.length ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={
                      order.status === "pending"
                        ? `/checkout/${order.id}`
                        : `/orders/${order.id}`
                    }
                    className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-ink-950">
                        {order.event_title}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-ink-400">
                        {order.reference} · {formatDateTime(order.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[12px] font-semibold">
                        {formatMoney(order.total_cents)}
                      </span>
                      <StatusBadge status={order.status} kind="order" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState
                  icon={<Receipt className="h-5 w-5" />}
                  title="No orders yet"
                  description="When you buy tickets, your orders and receipts will appear here."
                  actionHref="/events"
                  actionLabel="Discover events"
                />
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-400">
                Quick actions
              </p>
              <div className="mt-3 space-y-1.5">
                {[
                  { href: "/events", label: "Browse events", icon: CalendarDays },
                  { href: "/dashboard/tickets", label: "My tickets", icon: TicketIcon },
                  { href: "/dashboard/orders", label: "Receipts & orders", icon: Receipt },
                  { href: "/dashboard/profile", label: "Profile settings", icon: UserRound },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface"
                  >
                    <item.icon className="h-4 w-4 text-brand-600" /> {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-ink-950 p-5 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">
                At the gate
              </p>
              <p className="mt-2 font-display text-[15px] font-semibold">
                One scan, one entry.
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
                Open your ticket and show the QR code. Screenshots do not work twice — the
                same code cannot admit a second guest.
              </p>
              <Link
                href="/policies/customer-service"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-aqua-300"
              >
                Gate help <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
