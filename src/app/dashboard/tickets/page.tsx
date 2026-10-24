import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Download, QrCode, Ticket as TicketIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listAllUserTickets } from "@/lib/orders";
import { signTicketCode } from "@/lib/ticket-code";
import { formatDate } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tickets" };

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tickets", label: "My tickets" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/saved", label: "Saved" },
  { href: "/dashboard/parking", label: "Parking" },
  { href: "/dashboard/profile", label: "Profile" },
];

const views = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past events" },
  { key: "refunded", label: "Refunded" },
  { key: "all", label: "All tickets" },
];

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const { view = "upcoming" } = await searchParams;

  const tickets = listAllUserTickets(user.id);
  const now = Date.now();

  const refunded = tickets.filter((ticket) => ticket.order_status === "refunded");
  const active = tickets.filter((ticket) => ticket.order_status !== "refunded");
  const upcoming = active.filter(
    (ticket) =>
      ticket.status === "valid" && new Date(ticket.event_starts_at || 0).getTime() >= now,
  );
  const past = active.filter(
    (ticket) =>
      ticket.status !== "valid" || new Date(ticket.event_starts_at || 0).getTime() < now,
  );

  const visible =
    view === "past"
      ? past
      : view === "refunded"
        ? refunded
        : view === "all"
          ? tickets
          : upcoming;

  const activeView = ["past", "refunded", "all"].includes(view) ? view : "upcoming";
  const countFor = (key: string) =>
    key === "past" ? past.length : key === "refunded" ? refunded.length : key === "all" ? tickets.length : upcoming.length;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Attendee account"
        title="My tickets"
        description="Every ticket is unique, signed and valid for a single admission. Open a ticket to show or print its QR code."
        tabs={tabs}
        actions={
          <Link href="/events" className="btn btn-primary btn-sm">
            Find more events
          </Link>
        }
      />

      <div className="container-page pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
            {views.map((item) => (
              <Link
                key={item.key}
                href={`/dashboard/tickets?view=${item.key}`}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  activeView === item.key
                    ? "bg-ink-950 text-white"
                    : "border border-line bg-white text-ink-500 hover:text-ink-900"
                }`}
              >
                {item.label}
                <span className="ml-1.5 opacity-60">{countFor(item.key)}</span>
              </Link>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
            <QrCode className="h-3.5 w-3.5" /> QR codes load when you open a ticket
          </p>
        </div>

        {visible.length ? (
          view === "refunded" ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
              <p className="border-b border-line bg-surface/50 px-4 py-2.5 text-[11px] font-semibold text-ink-500">
                Tickets from refunded orders. The money is back with you, so these codes can
                never be scanned.
              </p>
              {refunded.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/orders/${ticket.order_id}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink-950">
                      {ticket.event_title}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-400">
                      {formatDate(ticket.event_starts_at)} · {ticket.ticket_type_name} ·{" "}
                      <span className="font-mono">{ticket.code}</span>
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                    Refunded
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {(view === "all" ? active : visible).map((ticket) => (
                  <div key={ticket.id} className="space-y-2">
                    <TicketCard
                      ticket={ticket}
                      qrValue={signTicketCode(ticket.code)}
                      compact
                    />
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
                        <CalendarDays className="h-3 w-3" />
                        {ticket.city} · {ticket.venue}
                      </span>
                      <div className="flex items-center gap-3">
                        {ticket.status !== "void" ? (
                          <a
                            href={`/api/tickets/${ticket.id}/pdf`}
                            download
                            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-500 hover:text-ink-900"
                          >
                            PDF <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <Link
                          href={`/dashboard/tickets/${ticket.id}`}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700"
                        >
                          Open ticket <QrCode className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {view === "all" && refunded.length ? (
                <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
                  <p className="border-b border-line bg-surface/50 px-4 py-2.5 text-[11px] font-semibold text-ink-500">
                    Refunded orders — these codes can never be scanned.
                  </p>
                  {refunded.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/orders/${ticket.order_id}`}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-ink-950">
                          {ticket.event_title}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-ink-400">
                          {formatDate(ticket.event_starts_at)} · {ticket.ticket_type_name}
                        </p>
                      </div>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                        Refunded
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          )
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<TicketIcon className="h-5 w-5" />}
              title={
                view === "past"
                  ? "No past tickets"
                  : view === "refunded"
                    ? "No refunded tickets"
                    : view === "all"
                      ? "No tickets yet"
                      : "No upcoming tickets"
              }
              description={
                view === "past"
                  ? "Tickets from events you have attended will be listed here."
                  : view === "refunded"
                    ? "If you ever refund an order, its tickets will be listed here for your records."
                    : "Find an event you love and your QR ticket will appear here right after payment."
              }
              actionHref="/events"
              actionLabel="Discover events"
            />
          </div>
        )}
      </div>
    </div>
  );
}
