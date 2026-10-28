import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  History,
  Inbox,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import { bookingCounts, listArtistBookings } from "@/lib/bookings";
import {
  BOOKING_STATUS_LABEL,
  EVENT_STATUS_LABEL,
  formatDate,
  formatMoney,
  formatTime,
  statusTone,
} from "@/lib/format";
import type { ArtistBookingWithEvent } from "@/lib/types";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { BookingActions } from "@/components/booking-actions";
import { BookingSettingsToggle } from "@/components/booking-settings-toggle";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bookings" };

function BookingCard({
  booking,
  showContact,
}: {
  booking: ArtistBookingWithEvent;
  showContact: boolean;
}) {
  const fee =
    booking.proposed_fee_cents === null
      ? "No fee proposed — discuss directly with the organizer"
      : formatMoney(booking.proposed_fee_cents, booking.currency);

  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink-950">
              {booking.event_title}
            </h3>
            <span className={`badge ${statusTone(booking.status)}`}>
              {BOOKING_STATUS_LABEL[booking.status] || booking.status}
            </span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-ink-400" /> {formatDate(booking.event_starts_at)} ·{" "}
              {formatTime(booking.event_starts_at)}
              {booking.event_ends_at ? ` – ${formatTime(booking.event_ends_at)}` : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-ink-400" /> {booking.event_venue} ·{" "}
              {booking.event_city}
            </span>
          </p>
        </div>
        {booking.event_status !== "approved" ? (
          <span className="rounded-full bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-ink-500 ring-1 ring-line">
            Event {EVENT_STATUS_LABEL[booking.event_status]?.toLowerCase() || booking.event_status}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface/60 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
            Organizer
          </p>
          <p className="mt-1 text-[12px] font-semibold text-ink-900">
            {booking.organizer_business || booking.organizer_name}
          </p>
          {showContact ? (
            <div className="mt-1 space-y-0.5 text-[11px] text-ink-500">
              <p className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-ink-400" /> {booking.organizer_email}
              </p>
              {booking.organizer_phone ? (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-ink-400" /> {booking.organizer_phone}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-[10.5px] text-ink-400">
              Contact details are shared after you accept.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-surface/60 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
            Proposed fee
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink-900">
            <CircleDollarSign className="h-3.5 w-3.5 text-ink-400" /> {fee}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-400">
            A talking point, not a payment. EventIQ does not process artist payments yet and this is
            not counted as earnings.
          </p>
        </div>
      </div>

      {booking.message ? (
        <p className="mt-3 whitespace-pre-line rounded-xl border border-line px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-600">
          {booking.message}
        </p>
      ) : null}

      {booking.response_note ? (
        <p className="mt-3 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-600">
          <strong>Your note:</strong> {booking.response_note}
        </p>
      ) : null}

      <BookingActions bookingId={booking.id} status={booking.status} />
    </article>
  );
}

export default async function ArtistBookingsPage() {
  const { profile } = await requireArtistPage();
  const bookings = listArtistBookings(profile.user_id);
  const counts = bookingCounts(profile.user_id);
  const now = Date.now();
  const upcoming = (booking: ArtistBookingWithEvent) =>
    new Date(booking.event_starts_at).getTime() > now;

  const pending = bookings.filter((booking) => booking.status === "requested" && upcoming(booking));
  const confirmed = bookings.filter((booking) => booking.status === "accepted" && upcoming(booking));
  const history = bookings.filter((booking) => !pending.includes(booking) && !confirmed.includes(booking));

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Bookings"
        description="Review organizer requests, confirm gigs and keep track of what you have played."
        tabs={artistTabs}
      />

      <div className="container-page max-w-5xl space-y-5 pt-6">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <BookingSettingsToggle accepting={!!profile.accepting_bookings} />
          <div className="flex flex-wrap gap-2 text-[11px] text-ink-500">
            <span className="rounded-full bg-surface px-2.5 py-1 ring-1 ring-line">
              {counts.requested || 0} awaiting response
            </span>
            <span className="rounded-full bg-surface px-2.5 py-1 ring-1 ring-line">
              {counts.accepted || 0} confirmed
            </span>
            <Link href="/artist/calendar" className="font-semibold text-brand-700 hover:underline">
              Open calendar
            </Link>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
              <Inbox className="h-4 w-4 text-brand-600" /> Requests awaiting your response
            </h2>
            <span className="text-[11px] text-ink-400">{pending.length}</span>
          </div>
          {pending.length ? (
            <div className="mt-3 space-y-3">
              {pending.map((booking) => (
                <BookingCard key={booking.id} booking={booking} showContact={false} />
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="No pending requests"
                description={
                  profile.accepting_bookings
                    ? "Approved organizers can request you from your public profile. New requests will appear here."
                    : "Booking requests are paused. Resume them to appear as available to organizers."
                }
              />
            </div>
          )}
        </section>

        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
              <CalendarCheck className="h-4 w-4 text-emerald-600" /> Confirmed and upcoming
            </h2>
            <span className="text-[11px] text-ink-400">{confirmed.length}</span>
          </div>
          {confirmed.length ? (
            <div className="mt-3 space-y-3">
              {confirmed.map((booking) => (
                <BookingCard key={booking.id} booking={booking} showContact />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-[11.5px] text-ink-400">
              Accepted bookings appear here with the organizer&apos;s contact details. Nothing is
              confirmed yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
            <History className="h-4 w-4 text-ink-400" /> Past and closed
          </h2>
          {history.length ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Organizer</th>
                      <th>Status</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((booking) => (
                      <tr key={booking.id}>
                        <td className="font-semibold text-ink-950">{booking.event_title}</td>
                        <td className="text-[11.5px] text-ink-500">
                          {formatDate(booking.event_starts_at)}
                        </td>
                        <td className="text-[11.5px] text-ink-500">
                          {booking.organizer_business || booking.organizer_name}
                        </td>
                        <td>
                          <span className={`badge ${statusTone(booking.status)}`}>
                            {BOOKING_STATUS_LABEL[booking.status] || booking.status}
                          </span>
                        </td>
                        <td className="max-w-[240px] text-[11px] text-ink-500">
                          {booking.response_note || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-[11.5px] text-ink-400">
              Declined, withdrawn and cancelled requests are kept here for your records.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
