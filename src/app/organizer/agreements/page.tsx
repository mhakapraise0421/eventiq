import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSignature, Send } from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import {
  listAcceptedBookingsWithoutAgreement,
  listOrganizerAgreements,
} from "@/lib/agreements";
import {
  AGREEMENT_STATUS_LABEL,
  formatDate,
  formatMoney,
  formatMoneyExact,
  statusTone,
} from "@/lib/format";
import type { ArtistAgreementWithContext } from "@/lib/types";
import { ConsoleHeader } from "@/components/console-header";
import { AgreementForm } from "@/components/agreement-form";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agreements · Organizer" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/agreements", label: "Agreements" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

function AgreementRow({ agreement }: { agreement: ArtistAgreementWithContext }) {
  const fee = agreement.accepted_fee_cents ?? agreement.current_fee_cents;
  const received = Number(agreement.payments_received_cents || 0);
  const recorded = Number(agreement.payments_recorded_cents || 0);
  const outstanding = Math.max(0, fee - received);

  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[14px] font-semibold text-ink-950">
              {agreement.artist_stage_name}
            </span>
            <span className={`badge ${statusTone(agreement.status)}`}>
              {AGREEMENT_STATUS_LABEL[agreement.status] || agreement.status}
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-500 ring-1 ring-line">
              v{agreement.current_version}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {agreement.event_title} · {formatDate(agreement.event_starts_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[14px] font-semibold text-ink-950">
            {formatMoneyExact(fee, agreement.current_currency)}
          </p>
          <p className="text-[10px] text-ink-400">
            {agreement.accepted_fee_cents === null ? "draft fee" : "agreed fee"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-ink-500">
          <span>Received {formatMoney(received, agreement.current_currency)}</span>
          {recorded > 0 ? (
            <span className="text-amber-700">
              Awaiting artist confirmation {formatMoney(recorded, agreement.current_currency)}
            </span>
          ) : null}
          <span>Outstanding {formatMoney(outstanding, agreement.current_currency)}</span>
        </div>
        <Link
          href={`/organizer/agreements/${agreement.id}`}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:underline"
        >
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {agreement.current_status === "changes_requested" && agreement.current_response_note ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          <strong>Artist requested changes:</strong> {agreement.current_response_note}
        </p>
      ) : null}
    </article>
  );
}

export default async function OrganizerAgreementsPage() {
  const { user, profile } = await requireApprovedOrganizer();
  const agreements = listOrganizerAgreements(user.id);
  const withoutAgreement = listAcceptedBookingsWithoutAgreement(user.id);
  const awaitingArtist = agreements.filter(
    (agreement) => agreement.current_status === "sent",
  ).length;
  const accepted = agreements.filter(
    (agreement) => agreement.accepted_version !== null,
  ).length;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow={`${profile.business_name} · Organizer console`}
        title="Artist agreements"
        description="Turn confirmed bookings into written agreements, record payments and follow the artist's confirmation."
        tabs={tabs}
        actions={
          <Link href="/organizer/artists" className="btn btn-outline btn-sm">
            Bookings
          </Link>
        }
      />

      <div className="container-page max-w-5xl space-y-5 pt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Agreements
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">{agreements.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              With an accepted version
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">{accepted}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              Awaiting artist response
            </p>
            <p className="mt-1.5 font-display text-[20px] font-semibold">{awaitingArtist}</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="h-fit rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <Send className="h-4 w-4 text-brand-600" /> New agreement
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              Agreements start from one of your confirmed bookings. The artist reviews and accepts
              the draft before it counts as contracted earnings.
            </p>
            <div className="mt-4">
              <AgreementForm
                mode="create"
                bookings={withoutAgreement.map((booking) => ({
                  id: booking.id,
                  artist_stage_name: booking.artist_stage_name,
                  event_title: booking.event_title,
                  proposed_fee_cents: booking.proposed_fee_cents,
                }))}
              />
            </div>
          </section>

          <div className="space-y-4">
            <section>
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                All agreements
              </h2>
              {agreements.length ? (
                <div className="mt-3 space-y-2">
                  {agreements.map((agreement) => (
                    <AgreementRow key={agreement.id} agreement={agreement} />
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <EmptyState
                    icon={<FileSignature className="h-5 w-5" />}
                    title="No agreements yet"
                    description="Confirm a booking first, then draft the agreement with the fee, deposit and terms."
                    actionHref="/organizer/artists"
                    actionLabel="Go to bookings"
                  />
                </div>
              )}
            </section>

            {withoutAgreement.length ? (
              <section className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-[12.5px] font-semibold text-ink-900">
                  Confirmed bookings without an agreement
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {withoutAgreement.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface/60 px-3 py-2 text-[11px]"
                    >
                      <span className="font-semibold text-ink-800">
                        {booking.artist_stage_name} · {booking.event_title}
                      </span>
                      <span className="text-ink-500">
                        {booking.proposed_fee_cents === null
                          ? "No proposed fee"
                          : `${formatMoney(booking.proposed_fee_cents, booking.currency)} proposed`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>

        <p className="text-[10.5px] leading-relaxed text-ink-400">
          Drafts stay private until you send them. Accepted versions cannot be edited; changes are
          added as a new version for the artist to accept. EventIQ does not hold or process artist
          payments — recording a payment logs it for the artist to confirm.
        </p>
      </div>
    </div>
  );
}
