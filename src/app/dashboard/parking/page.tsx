import type { Metadata } from "next";
import Link from "next/link";
import { CarFront, CircleParking, Info, MapPin, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserTickets, releaseExpiredOrders } from "@/lib/orders";
import { formatDate, formatMoney, formatTimeRange } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parking" };

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tickets", label: "My tickets" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/saved", label: "Saved" },
  { href: "/dashboard/parking", label: "Parking" },
  { href: "/dashboard/profile", label: "Profile" },
];

const SAMPLE_PASSES = [
  {
    name: "Open-air parking",
    description: "Uncovered bay, first-come positioning within the sample lot.",
    price_cents: 300,
  },
  {
    name: "Covered bay",
    description: "Shaded bay closer to the entrance, guaranteed until gates open.",
    price_cents: 500,
  },
];

export default async function ParkingPage() {
  const user = await requireUser();
  releaseExpiredOrders();

  const tickets = getUserTickets(user.id);
  const now = Date.now();
  const upcoming = tickets.filter(
    (ticket) =>
      ticket.status === "valid" && new Date(ticket.event_starts_at || 0).getTime() >= now,
  );
  const seen = new Set<string>();
  const events = upcoming.filter((ticket) => {
    if (seen.has(ticket.event_id)) return false;
    seen.add(ticket.event_id);
    return true;
  });

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Attendee account"
        title="Event parking"
        description="Add parking to the events you already have tickets for. Parking spaces are counted separately from tickets."
        tabs={tabs}
      />

      <div className="container-page pt-6">
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Sample preview.</strong> The passes and prices below are sample data so
            you can see the design. Parking checkout is not built yet — nothing here can be
            reserved or paid for, and your event tickets never automatically include parking.
          </p>
        </div>

        {events.length ? (
          <div className="mt-6 space-y-5">
            {events.map((ticket) => (
              <section
                key={ticket.event_id}
                className="overflow-hidden rounded-2xl border border-line bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/50 px-5 py-4">
                  <div>
                    <p className="flex items-center gap-2 font-display text-[15.5px] font-semibold text-ink-950">
                      <CarFront className="h-4 w-4 text-brand-600" />
                      {ticket.event_title}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-400">
                      <span>{formatDate(ticket.event_starts_at)}</span>
                      <span>
                        {formatTimeRange(ticket.event_starts_at, ticket.event_ends_at)} CAT
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {ticket.venue}, {ticket.city}
                      </span>
                    </p>
                  </div>
                  <span className="badge bg-amber-100 text-amber-800">Sample inventory</span>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {SAMPLE_PASSES.map((pass) => (
                    <div
                      key={pass.name}
                      className="rounded-xl border border-line p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-950">
                          <CircleParking className="h-3.5 w-3.5 text-brand-600" />
                          {pass.name}
                        </p>
                        <span className="text-[13px] font-semibold text-ink-900">
                          {formatMoney(pass.price_cents)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                        {pass.description}
                      </p>
                      <button
                        type="button"
                        disabled
                        className="btn btn-outline btn-sm mt-3 w-full"
                      >
                        Reserve pass
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-950">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> How parking will work
              </p>
              <ul className="mt-2.5 space-y-2 text-[11.5px] leading-relaxed text-ink-500">
                <li>Parking spaces come from their own inventory, separate from tickets.</li>
                <li>A parking pass is only valid together with a valid event ticket.</li>
                <li>Passes get their own QR code, scanned at the parking gate.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-[12.5px] font-semibold text-ink-950">No upcoming events</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
                Once you have a valid ticket for an upcoming event, sample parking options
                for that event will appear here.
              </p>
              <Link href="/events" className="btn btn-primary btn-sm mt-3">
                Find an event
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
