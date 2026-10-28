import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Send, Users } from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import {
  listBookableArtists,
  listOrganizerBookableEvents,
  listOrganizerBookings,
} from "@/lib/bookings";
import {
  BOOKING_STATUS_LABEL,
  formatDate,
  formatMoney,
  formatTime,
  statusTone,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { BookingRequestForm } from "@/components/booking-request-form";
import { WithdrawBookingButton } from "@/components/withdraw-booking-button";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artists · Organizer" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/agreements", label: "Agreements" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

export default async function OrganizerArtistsPage() {
  const { user, profile } = await requireApprovedOrganizer();
  const artists = listBookableArtists();
  const events = listOrganizerBookableEvents(user.id);
  const bookings = listOrganizerBookings(user.id);
  const open = bookings.filter((booking) => booking.status === "requested");
  const confirmed = bookings.filter((booking) => booking.status === "accepted");
  const active = bookings.filter(
    (booking) => booking.status === "requested" || booking.status === "accepted",
  );
  const closed = bookings.filter(
    (booking) => booking.status !== "requested" && booking.status !== "accepted",
  );

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow={`${profile.business_name} · Organizer console`}
        title="Artists and bookings"
        description="Request performers for your events, track responses and keep your lineup organised."
        tabs={tabs}
        actions={
          <Link href="/artists" className="btn btn-outline btn-sm">
            <Users className="h-3.5 w-3.5" /> Artist directory
          </Link>
        }
      />

      <div className="container-page max-w-5xl space-y-5 pt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Awaiting response
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">{open.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Confirmed artists
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">{confirmed.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Bookable artists
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">{artists.length}</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="h-fit rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <Send className="h-4 w-4 text-brand-600" /> New booking request
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              Only published artists who are accepting requests appear here.
            </p>
            <div className="mt-4">
              {artists.length ? (
                <BookingRequestForm
                  artists={artists.map((artist) => ({
                    id: artist.user_id,
                    stageName: artist.stage_name,
                    verified: artist.verification_status === "verified",
                  }))}
                  events={events}
                />
              ) : (
                <p className="rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-500">
                  No artists are accepting requests right now. Browse the{" "}
                  <Link href="/artists" className="font-semibold text-brand-700 hover:underline">
                    artist directory
                  </Link>{" "}
                  to see who is available.
                </p>
              )}
            </div>
          </section>

          <div className="space-y-5">
            <section>
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                Requests sent
              </h2>
              {active.length ? (
                <div className="mt-3 space-y-2">
                  {active.map((booking) => (
                    <article
                      key={booking.id}
                      className="rounded-2xl border border-line bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link
                            href={`/artists/${booking.artist_slug}`}
                            className="font-display text-[14px] font-semibold text-ink-950 hover:text-brand-700"
                          >
                            {booking.artist_stage_name}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-ink-500">
                            {booking.event_title} · {formatDate(booking.event_starts_at)}{" "}
                            {formatTime(booking.event_starts_at)}
                          </p>
                        </div>
                        <span className={`badge ${statusTone(booking.status)}`}>
                          {BOOKING_STATUS_LABEL[booking.status] || booking.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-400">
                        <span>
                          Proposed fee:{" "}
                          <strong className="font-semibold text-ink-700">
                            {booking.proposed_fee_cents === null
                              ? "none — discuss"
                              : formatMoney(booking.proposed_fee_cents, booking.currency)}
                          </strong>{" "}
                          (not a payment or artist earnings)
                        </span>
                        {booking.status === "requested" ? (
                          <WithdrawBookingButton bookingId={booking.id} />
                        ) : null}
                        {booking.status === "accepted" ? (
                          <Link
                            href={`/artists/${booking.artist_slug}`}
                            className="inline-flex items-center gap-0.5 font-semibold text-brand-700 hover:underline"
                          >
                            View artist profile <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </div>

                      {booking.response_note ? (
                        <p className="mt-2 rounded-lg bg-surface/60 px-3 py-2 text-[11px] leading-relaxed text-ink-600">
                          <strong>Artist note:</strong> {booking.response_note}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <EmptyState
                    icon={<Users className="h-5 w-5" />}
                    title="No booking requests yet"
                    description="Pick an artist and one of your upcoming events to send your first request."
                    actionHref="/artists"
                    actionLabel="Browse artists"
                  />
                </div>
              )}
            </section>

            {closed.length ? (
              <section>
                <h2 className="font-display text-[15px] font-semibold tracking-[-0.02em]">
                  Closed requests
                </h2>
                <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="hide-scrollbar overflow-x-auto">
                    <table className="table-base min-w-[520px]">
                      <thead>
                        <tr>
                          <th>Artist</th>
                          <th>Event</th>
                          <th>Status</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closed.map((booking) => (
                          <tr key={booking.id}>
                            <td className="font-semibold">{booking.artist_stage_name}</td>
                            <td className="text-[11.5px] text-ink-500">{booking.event_title}</td>
                            <td>
                              <span className={`badge ${statusTone(booking.status)}`}>
                                {BOOKING_STATUS_LABEL[booking.status] || booking.status}
                              </span>
                            </td>
                            <td className="max-w-[220px] text-[11px] text-ink-500">
                              {booking.response_note || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <p className="text-[10.5px] leading-relaxed text-ink-400">
          Booking requests link an artist to one of your own events. A proposed fee is a discussion
          starting point only — EventIQ does not process artist payments yet, and these figures are
          never treated as artist earnings.
        </p>
      </div>
    </div>
  );
}
