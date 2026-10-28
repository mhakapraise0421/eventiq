import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  Eye,
  FileSignature,
  Inbox,
  ListChecks,
  Pencil,
  Wallet,
} from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import {
  listArtistDocuments,
  listArtistVerificationHistory,
  parseGenres,
  profileGaps,
} from "@/lib/artists";
import { listArtistBookings } from "@/lib/bookings";
import { earningsSummary, listArtistAgreements } from "@/lib/agreements";
import {
  BOOKING_STATUS_LABEL,
  formatDate,
  formatDayParts,
  formatMoney,
  formatTimeRange,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { ProgressBar } from "@/components/charts";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist dashboard" };

interface DonutSegment {
  status: string;
  label: string;
  count: number;
  color: string;
}

function BookingDonut({
  segments,
  total,
}: {
  segments: DonutSegment[];
  total: number;
}) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth="13"
        />
        {segments.map((segment) => {
          const length = (segment.count / total) * circumference;
          const dash = Math.max(1, length - 2);
          const offset = cursor;
          cursor += length;
          return (
            <circle
              key={segment.status}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="13"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[22px] font-semibold tracking-[-0.03em] text-ink-950">
          {total}
        </span>
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
          bookings
        </span>
      </div>
    </div>
  );
}

export default async function ArtistOverviewPage() {
  const { profile } = await requireArtistPage();
  const gaps = profileGaps(profile);
  const documents = listArtistDocuments(profile.user_id);
  const history = listArtistVerificationHistory(profile.user_id);
  const latest = history[0];
  const genres = parseGenres(profile);
  const bookings = listArtistBookings(profile.user_id);
  const now = Date.now();
  const pendingCount = bookings.filter(
    (booking) =>
      booking.status === "requested" && new Date(booking.event_starts_at).getTime() > now,
  ).length;
  const nextConfirmed = bookings
    .filter(
      (booking) =>
        booking.status === "accepted" && new Date(booking.event_starts_at).getTime() > now,
    )
    .sort(
      (a, b) =>
        new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime(),
    )[0];
  const agreements = listArtistAgreements(profile.user_id);
  const awaitingAgreements = agreements.filter(
    (agreement) => agreement.current_status === "sent",
  ).length;
  const earnings = earningsSummary(profile.user_id);

  const upcoming = bookings
    .filter(
      (booking) =>
        (booking.status === "accepted" || booking.status === "requested") &&
        new Date(booking.event_starts_at).getTime() > now,
    )
    .sort(
      (a, b) =>
        new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime(),
    );
  const upcomingPreview = upcoming.slice(0, 4);
  const confirmedAhead = upcoming.filter((booking) => booking.status === "accepted").length;

  const statusCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});
  const statusColors: Array<{ status: string; color: string }> = [
    { status: "accepted", color: "#10b981" },
    { status: "requested", color: "#fbbf24" },
    { status: "declined", color: "#fb7185" },
    { status: "cancelled", color: "#a1a1aa" },
    { status: "withdrawn", color: "#d4d4d8" },
  ];
  const donutSegments: DonutSegment[] = statusColors
    .filter((entry) => (statusCounts[entry.status] || 0) > 0)
    .map((entry) => ({
      ...entry,
      label: BOOKING_STATUS_LABEL[entry.status] || entry.status,
      count: statusCounts[entry.status] || 0,
    }));

  const harareHour = new Date(now + 2 * 60 * 60_000).getUTCHours();
  const greeting =
    harareHour < 12 ? "Good morning" : harareHour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile.stage_name.split(/\s+/)[0];
  const bandLine = pendingCount
    ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting for your reply`
    : "No requests waiting — your queue is clear";
  const readinessLabel = gaps.length
    ? `${gaps.length} item${gaps.length === 1 ? "" : "s"} left`
    : "Ready to go";

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title={profile.stage_name}
        description={`${profile.category}${genres.length ? ` · ${genres.join(", ")}` : ""}${
          profile.city ? ` · ${profile.city}` : ""
        }`}
        tabs={artistTabs}
        actions={
          <>
            <Link href="/artist/profile" className="btn btn-outline btn-sm">
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </Link>
            {profile.visibility === "published" ? (
              <Link href={`/artists/${profile.slug}`} className="btn btn-primary btn-sm">
                <Eye className="h-3.5 w-3.5" /> View public profile
              </Link>
            ) : null}
          </>
        }
      />

      <div className="container-page max-w-5xl space-y-4 pt-6">
        <section className="relative overflow-hidden rounded-3xl bg-ink-950 px-5 py-6 text-white sm:px-7 sm:py-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-600/35 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-aqua-400/20 blur-3xl"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-aqua-300/80">
                {greeting} · {formatDate(new Date(now).toISOString())}
              </p>
              <h2 className="mt-2 font-display text-[23px] font-semibold tracking-[-0.03em] sm:text-[27px]">
                Hey {firstName}, {bandLine.toLowerCase()}
              </h2>
              <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-white/60">
                {nextConfirmed
                  ? `Next confirmed gig: ${nextConfirmed.event_title} on ${formatDate(
                      nextConfirmed.event_starts_at,
                    )} at ${nextConfirmed.event_venue}.`
                  : "No confirmed bookings yet. Publish your profile so organizers can find you."}
                {!profile.accepting_bookings ? " Booking requests are currently paused." : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/artist/calendar"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[12px] font-semibold text-ink-950 transition hover:bg-aqua-300"
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar
              </Link>
              <Link
                href="/artist/bookings"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-white/10"
              >
                <Inbox className="h-3.5 w-3.5" /> Requests
                {pendingCount > 0 ? (
                  <span className="rounded-full bg-aqua-400 px-1.5 py-0.5 text-[9.5px] font-bold text-ink-950">
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-4">
            <div className="bg-ink-950/95 px-4 py-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Awaiting reply
              </p>
              <p
                className={`mt-1 font-display text-[20px] font-semibold tracking-[-0.03em] ${
                  pendingCount > 0 ? "text-aqua-300" : "text-white"
                }`}
              >
                {pendingCount}
              </p>
              <p className="text-[9.5px] text-white/40">upcoming requests</p>
            </div>
            <div className="bg-ink-950/95 px-4 py-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Confirmed ahead
              </p>
              <p className="mt-1 font-display text-[20px] font-semibold tracking-[-0.03em] text-white">
                {confirmedAhead}
              </p>
              <p className="text-[9.5px] text-white/40">accepted gigs</p>
            </div>
            <div className="bg-ink-950/95 px-4 py-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Contracted
              </p>
              <p className="mt-1 font-display text-[20px] font-semibold tracking-[-0.03em] text-white">
                {formatMoney(earnings.contractedCents)}
              </p>
              <p className="text-[9.5px] text-white/40">accepted agreements</p>
            </div>
            <div className="bg-ink-950/95 px-4 py-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Outstanding
              </p>
              <p
                className={`mt-1 font-display text-[20px] font-semibold tracking-[-0.03em] ${
                  earnings.outstandingCents > 0 ? "text-amber-300" : "text-white"
                }`}
              >
                {formatMoney(earnings.outstandingCents)}
              </p>
              <p className="text-[9.5px] text-white/40">not yet received</p>
            </div>
          </div>
        </section>

        {gaps.length ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
              <ListChecks className="h-4 w-4" /> Finish your profile
            </p>
            <ul className="mt-2 grid gap-1 text-[11.5px] text-amber-800/90 sm:grid-cols-2">
              {gaps.map((gap) => (
                <li key={gap} className="flex items-start gap-1.5">
                  <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {gap}
                </li>
              ))}
            </ul>
            <Link href="/artist/profile" className="btn btn-outline btn-sm mt-3">
              Complete profile <ArrowRight className="h-3 w-3" />
            </Link>
          </section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
                    <CalendarClock className="h-4 w-4 text-brand-600" /> Next up
                  </h2>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {upcoming.length
                      ? `${upcoming.length} booking${upcoming.length === 1 ? "" : "s"} ahead · Africa/Harare`
                      : "Nothing on the calendar yet."}
                  </p>
                </div>
                <Link
                  href="/artist/bookings"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                >
                  All bookings <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {upcomingPreview.length ? (
                <ol className="mt-4 space-y-2.5">
                  {upcomingPreview.map((booking) => {
                    const parts = formatDayParts(booking.event_starts_at);
                    const requested = booking.status === "requested";
                    return (
                      <li
                        key={booking.id}
                        className="flex gap-3 rounded-xl border border-line p-3 transition hover:border-brand-200 hover:bg-brand-50/30"
                      >
                        <div
                          className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 ${
                            requested
                              ? "bg-amber-50 text-amber-700"
                              : "bg-brand-50 text-brand-700"
                          }`}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                            {parts.weekday}
                          </span>
                          <span className="font-display text-[19px] font-semibold leading-tight tracking-[-0.03em]">
                            {parts.day}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-[0.06em]">
                            {parts.month}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="truncate text-[12.5px] font-semibold text-ink-950">
                              {booking.event_title}
                            </p>
                            <StatusBadge
                              status={booking.status}
                              label={BOOKING_STATUS_LABEL[booking.status] || booking.status}
                            />
                          </div>
                          <p className="mt-0.5 text-[10.5px] text-ink-500">
                            {formatTimeRange(booking.event_starts_at, booking.event_ends_at)} ·{" "}
                            {booking.event_venue}
                            {booking.event_city ? `, ${booking.event_city}` : ""}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-400">
                            <span className="truncate">
                              {requested ? "Requested by" : "Organizer"}:{" "}
                              {booking.organizer_business || booking.organizer_name}
                            </span>
                            {requested && booking.proposed_fee_cents !== null ? (
                              <span
                                className="rounded-full bg-surface px-2 py-0.5 font-semibold text-ink-500"
                                title="A proposed fee is a discussion point, not confirmed earnings."
                              >
                                Proposed {formatMoney(booking.proposed_fee_cents)}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center">
                  <p className="text-[12px] font-semibold text-ink-700">No upcoming bookings</p>
                  <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-ink-400">
                    Confirmed gigs and pending requests will appear here as soon as organizers
                    reach out.
                  </p>
                  <Link
                    href={profile.visibility === "published" ? "/artist/calendar" : "/artist/profile"}
                    className="btn btn-outline btn-sm mt-3"
                  >
                    {profile.visibility === "published" ? "Open calendar" : "Finish your profile"}
                  </Link>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
                <BadgeCheck className="h-4 w-4 text-brand-600" /> Profile and trust
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                    Verification
                  </p>
                  <div className="mt-2">
                    <StatusBadge
                      status={profile.verification_status}
                      kind="verification"
                    />
                  </div>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
                    {profile.verification_status === "verified"
                      ? "EventIQ reviewed your identity documents."
                      : profile.verification_status === "pending"
                        ? "A reviewer is looking at your documents."
                        : "Submit identity documents to apply for a badge."}
                  </p>
                  {latest?.decision_note ? (
                    <p className="mt-2 line-clamp-2 rounded-lg bg-surface/70 px-2.5 py-1.5 text-[10px] leading-relaxed text-ink-500">
                      Reviewer note: {latest.decision_note}
                    </p>
                  ) : null}
                  <Link
                    href="/artist/verification"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                  >
                    {profile.verification_status === "verified" ? "View verification" : "Open verification"}{" "}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="rounded-xl border border-line p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                    Directory listing
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 font-display text-[16px] font-semibold text-ink-950">
                    <Eye
                      className={`h-4 w-4 ${
                        profile.visibility === "published" ? "text-emerald-600" : "text-ink-300"
                      }`}
                    />
                    {profile.visibility === "published" ? "Published" : "Draft"}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
                    {profile.visibility === "published"
                      ? "Organizers can find and request you."
                      : "Only you can see this profile right now."}
                  </p>
                  <p className="mt-2 text-[10px] text-ink-400">
                    {readinessLabel} · {documents.length} private document
                    {documents.length === 1 ? "" : "s"} on file
                  </p>
                  <Link
                    href="/artist/profile"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                  >
                    Edit profile <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-display text-[15px] font-semibold tracking-[-0.02em]">
                Booking status
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-400">Every request you have received.</p>
              <div className="mt-4 flex items-center gap-5">
                <BookingDonut segments={donutSegments} total={bookings.length} />
                {donutSegments.length ? (
                  <ul className="min-w-0 flex-1 space-y-1.5">
                    {donutSegments.map((segment) => (
                      <li
                        key={segment.status}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="flex items-center gap-2 text-ink-600">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: segment.color }}
                          />
                          {segment.label}
                        </span>
                        <span className="font-semibold text-ink-950">{segment.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] leading-relaxed text-ink-400">
                    No booking requests yet. A published profile is the first step.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="font-display text-[14px] font-semibold tracking-[-0.02em]">
                Quick actions
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { href: "/artist/bookings", label: "Requests", icon: <Inbox className="h-3.5 w-3.5" /> },
                  { href: "/artist/calendar", label: "Calendar", icon: <CalendarDays className="h-3.5 w-3.5" /> },
                  { href: "/artist/agreements", label: "Agreements", icon: <FileSignature className="h-3.5 w-3.5" /> },
                  { href: "/artist/reports", label: "Reports", icon: <ListChecks className="h-3.5 w-3.5" /> },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-[11.5px] font-semibold text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-700 transition group-hover:bg-white">
                      {action.icon}
                    </span>
                    {action.label}
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
                  <Wallet className="h-4 w-4 text-brand-600" /> Agreements & earnings
                </h2>
                <Link
                  href="/artist/earnings"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                >
                  Earnings <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Contracted
                  </dt>
                  <dd className="mt-0.5 font-display text-[14px] font-semibold text-ink-950">
                    {formatMoney(earnings.contractedCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Received
                  </dt>
                  <dd className="mt-0.5 font-display text-[14px] font-semibold text-emerald-700">
                    {formatMoney(earnings.receivedCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Outstanding
                  </dt>
                  <dd className="mt-0.5 font-display text-[14px] font-semibold text-amber-700">
                    {formatMoney(earnings.outstandingCents)}
                  </dd>
                </div>
              </dl>

              <div className="mt-3">
                <ProgressBar
                  value={earnings.receivedCents}
                  max={earnings.contractedCents || 1}
                  tone="emerald"
                />
                <p className="mt-1.5 text-[10px] text-ink-400">
                  Collected against contracted fees from accepted agreements only.
                </p>
              </div>

              {awaitingAgreements > 0 ? (
                <Link
                  href="/artist/agreements"
                  className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                >
                  <span>
                    {awaitingAgreements} agreement{awaitingAgreements === 1 ? "" : "s"} awaiting your
                    review
                  </span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}

              <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
                Only accepted agreements count as contracted earnings, and only payments you
                confirm count as received. Proposed fees are never counted. EventIQ does not
                process artist payments.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
