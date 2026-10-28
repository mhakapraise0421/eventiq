import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSignature, Inbox, History } from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import { listArtistAgreements } from "@/lib/agreements";
import {
  AGREEMENT_STATUS_LABEL,
  formatDate,
  formatMoney,
  formatMoneyExact,
  statusTone,
} from "@/lib/format";
import type { ArtistAgreementWithContext } from "@/lib/types";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agreements" };

function AgreementCard({ agreement }: { agreement: ArtistAgreementWithContext }) {
  const fee = agreement.accepted_fee_cents ?? agreement.current_fee_cents;
  const received = Number(agreement.payments_received_cents || 0);
  const outstanding = Math.max(0, fee - received);

  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink-950">
              {agreement.event_title}
            </h3>
            <span className={`badge ${statusTone(agreement.status)}`}>
              {AGREEMENT_STATUS_LABEL[agreement.status] || agreement.status}
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-500 ring-1 ring-line">
              v{agreement.current_version}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-ink-500">
            {agreement.organizer_business || agreement.organizer_name} ·{" "}
            {formatDate(agreement.event_starts_at)} · {agreement.event_venue}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
            {agreement.accepted_fee_cents === null ? "Draft fee" : "Agreed fee"}
          </p>
          <p className="mt-0.5 font-display text-[16px] font-semibold text-ink-950">
            {formatMoneyExact(fee, agreement.current_currency)}
          </p>
        </div>
      </div>

      {agreement.current_status === "sent" ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11.5px] text-amber-800">
          A {agreement.accepted_version ? "new version is" : "draft is"} waiting for your review.
        </p>
      ) : null}
      {agreement.current_status === "changes_requested" ? (
        <p className="mt-3 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11.5px] text-ink-600">
          You asked for changes. The organizer is revising the agreement.
        </p>
      ) : null}
      {agreement.accepted_version && agreement.current_status !== "accepted" ? (
        <p className="mt-3 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11.5px] text-ink-600">
          Version {agreement.accepted_version} remains the accepted agreement while this change is
          being reviewed.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-[10.5px] text-ink-500">
          <span className="rounded-full bg-surface px-2.5 py-1 ring-1 ring-line">
            Received {formatMoney(received, agreement.current_currency)}
          </span>
          <span className="rounded-full bg-surface px-2.5 py-1 ring-1 ring-line">
            Outstanding {formatMoney(outstanding, agreement.current_currency)}
          </span>
        </div>
        <Link
          href={`/artist/agreements/${agreement.id}`}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:underline"
        >
          Open agreement <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}

export default async function ArtistAgreementsPage() {
  const { profile } = await requireArtistPage();
  const agreements = listArtistAgreements(profile.user_id);
  const needsResponse = agreements.filter((entry) => entry.current_status === "sent");
  const active = agreements.filter((entry) => entry.current_status === "accepted");
  const other = agreements.filter(
    (entry) => entry.current_status !== "sent" && entry.current_status !== "accepted",
  );

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Agreements"
        description="Review the terms of each confirmed booking, accept them and keep every version on record."
        tabs={artistTabs}
        actions={
          <Link href="/artist/earnings" className="btn btn-outline btn-sm">
            Earnings overview
          </Link>
        }
      />

      <div className="container-page max-w-5xl space-y-5 pt-6">
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-[11px] leading-relaxed text-ink-500">
          An accepted agreement is what counts as contracted earnings. Proposed booking fees are
          never counted, and EventIQ does not process artist payments — organizers record payments
          and you confirm them.
        </p>

        {agreements.length === 0 ? (
          <EmptyState
            icon={<FileSignature className="h-5 w-5" />}
            title="No agreements yet"
            description="When you accept a booking, the organizer can draft an agreement with the fee, deposit and performance terms. It will appear here for your review."
            actionHref="/artist/bookings"
            actionLabel="Go to bookings"
          />
        ) : (
          <>
            <section>
              <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
                <Inbox className="h-4 w-4 text-amber-600" /> Waiting for your review
              </h2>
              {needsResponse.length ? (
                <div className="mt-3 space-y-3">
                  {needsResponse.map((agreement) => (
                    <AgreementCard key={agreement.id} agreement={agreement} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-[11.5px] text-ink-400">
                  Nothing is waiting for your review.
                </p>
              )}
            </section>

            <section>
              <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
                <FileSignature className="h-4 w-4 text-emerald-600" /> Accepted agreements
              </h2>
              {active.length ? (
                <div className="mt-3 space-y-3">
                  {active.map((agreement) => (
                    <AgreementCard key={agreement.id} agreement={agreement} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-[11.5px] text-ink-400">
                  No accepted agreements yet.
                </p>
              )}
            </section>

            {other.length ? (
              <section>
                <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
                  <History className="h-4 w-4 text-ink-400" /> Drafts and revisions
                </h2>
                <div className="mt-3 space-y-3">
                  {other.map((agreement) => (
                    <AgreementCard key={agreement.id} agreement={agreement} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
