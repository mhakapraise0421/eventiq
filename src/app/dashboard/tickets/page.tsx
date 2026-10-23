import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, QrCode, Ticket as TicketIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserTickets } from "@/lib/orders";
import { signTicketCode } from "@/lib/ticket-code";
import { ConsoleHeader } from "@/components/console-header";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tickets" };

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tickets", label: "My tickets" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/profile", label: "Profile" },
];

const views = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past events" },
  { key: "all", label: "All tickets" },
];

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const { view = "upcoming" } = await searchParams;

  const tickets = getUserTickets(user.id);
  const now = Date.now();

  const upcoming = tickets.filter(
    (ticket) => new Date(ticket.event_starts_at || 0).getTime() >= now,
  );
  const past = tickets.filter(
    (ticket) => new Date(ticket.event_starts_at || 0).getTime() < now,
  );

  const visible = view === "past" ? past : view === "all" ? tickets : upcoming;

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
                  view === item.key || (!["past", "all"].includes(view) && item.key === "upcoming")
                    ? "bg-ink-950 text-white"
                    : "border border-line bg-white text-ink-500 hover:text-ink-900"
                }`}
              >
                {item.label}
                <span className="ml-1.5 opacity-60">
                  {item.key === "past" ? past.length : item.key === "all" ? tickets.length : upcoming.length}
                </span>
              </Link>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
            <QrCode className="h-3.5 w-3.5" /> QR codes load when you open a ticket
          </p>
        </div>

        {visible.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {visible.map((ticket) => (
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
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700"
                  >
                    Open ticket <QrCode className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<TicketIcon className="h-5 w-5" />}
              title={
                view === "past"
                  ? "No past tickets"
                  : view === "all"
                    ? "No tickets yet"
                    : "No upcoming tickets"
              }
              description={
                view === "past"
                  ? "Tickets from events you have attended will be listed here."
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
