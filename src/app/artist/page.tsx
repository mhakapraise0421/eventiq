import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
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
import { formatDate, formatMoney } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist dashboard" };

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Verification
            </p>
            <div className="mt-2">
              <StatusBadge status={profile.verification_status} kind="verification" />
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
              {profile.verification_status === "verified"
                ? "EventIQ reviewed your identity documents."
                : profile.verification_status === "pending"
                  ? "A reviewer is looking at your documents."
                  : "Submit identity documents to apply."}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Directory
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 font-display text-[18px] font-semibold text-ink-950">
              {profile.visibility === "published" ? (
                <>
                  <Eye className="h-4 w-4 text-emerald-600" /> Published
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-ink-300" /> Draft
                </>
              )}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
              {profile.visibility === "published"
                ? "Visible in the public artist directory."
                : "Only you can see this profile right now."}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Documents
            </p>
            <p className="mt-1.5 font-display text-[18px] font-semibold text-ink-950">
              {documents.length}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
              Private identity files, only visible to you and reviewers.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Profile readiness
            </p>
            <p className="mt-1.5 font-display text-[18px] font-semibold text-ink-950">
              {gaps.length ? `${gaps.length} item${gaps.length === 1 ? "" : "s"} left` : "Ready"}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
              {gaps.length
                ? "Complete these before publishing."
                : "Your public profile has everything it needs."}
            </p>
          </div>
        </div>

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

        {latest ? (
          <section className="rounded-2xl border border-line bg-white p-5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
              <BadgeCheck className="h-4 w-4 text-brand-600" /> Latest verification request
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
              <StatusBadge status={latest.status} kind="verification" />
              <span>Submitted {formatDate(latest.created_at)}</span>
            </div>
            {latest.decision_note ? (
              <p className="mt-2 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-600">
                <strong>Reviewer note:</strong> {latest.decision_note}
              </p>
            ) : null}
            <Link href="/artist/verification" className="btn btn-ghost btn-sm mt-2">
              Open verification <ArrowRight className="h-3 w-3" />
            </Link>
          </section>
        ) : (
          <section className="rounded-2xl border border-line bg-white p-5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
              <BadgeCheck className="h-4 w-4 text-brand-600" /> Not verified yet
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
              Upload a national ID or artist registration document and submit a request. Verified
              profiles show an EventIQ badge in the directory.
            </p>
            <Link href="/artist/verification" className="btn btn-primary btn-sm mt-3">
              Start verification
            </Link>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
                <CalendarDays className="h-4 w-4 text-brand-600" /> Bookings and calendar
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <Inbox className="h-3.5 w-3.5 text-ink-400" /> {pendingCount} awaiting your
                  response
                </span>
                <span>
                  {nextConfirmed
                    ? `Next confirmed: ${nextConfirmed.event_title} · ${formatDate(
                        nextConfirmed.event_starts_at,
                      )}`
                    : "No confirmed bookings yet."}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/artist/bookings" className="btn btn-outline btn-sm">
                Bookings
              </Link>
              <Link href="/artist/calendar" className="btn btn-primary btn-sm">
                Calendar
              </Link>
            </div>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-ink-400">
            {profile.accepting_bookings
              ? "Your profile is listed as accepting booking requests."
              : "Booking requests are paused — organizers cannot request you until you resume."}{" "}
            Proposed fees are discussion points only; they are never counted as earnings.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
                <FileSignature className="h-4 w-4 text-brand-600" /> Agreements and earnings
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-ink-400" /> Contracted{" "}
                  {formatMoney(earnings.contractedCents)}
                </span>
                <span>Received {formatMoney(earnings.receivedCents)}</span>
                <span>Outstanding {formatMoney(earnings.outstandingCents)}</span>
                {awaitingAgreements > 0 ? (
                  <span className="font-semibold text-amber-700">
                    {awaitingAgreements} agreement{awaitingAgreements === 1 ? "" : "s"} awaiting your
                    review
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/artist/agreements" className="btn btn-outline btn-sm">
                Agreements
              </Link>
              <Link href="/artist/earnings" className="btn btn-primary btn-sm">
                Earnings
              </Link>
            </div>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-ink-400">
            Only accepted agreements count as contracted earnings, and only payments you confirm
            count as received. EventIQ does not process artist payments.
          </p>
        </section>
      </div>
    </div>
  );
}
