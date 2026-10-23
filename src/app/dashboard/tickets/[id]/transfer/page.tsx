import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Tag } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTicketForUser } from "@/lib/orders";
import { formatDate } from "@/lib/format";
import { TransferForm } from "@/components/transfer-form";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transfer ticket" };

export default async function TransferTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = getTicketForUser(id, user.id);
  if (!ticket) notFound();

  const isUpcoming = new Date(ticket.event_starts_at || 0).getTime() > Date.now();
  const transferable = ticket.status === "valid" && isUpcoming;
  const ticketLabel = `${ticket.event_title} · ${ticket.ticket_type_name}`;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <div className="container-page max-w-3xl pt-6">
        <Link
          href={`/dashboard/tickets/${ticket.id}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-400 hover:text-ink-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to ticket
        </Link>

        <div className="mt-4">
          <p className="eyebrow">Ticket actions</p>
          <h1 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.03em]">
            Transfer to someone else
          </h1>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[12px] text-brand-800">
          <Tag className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Design preview.</strong> Transfers arrive in Stage 5 — this screen shows
            exactly how the flow will work, but submitting is disabled and nothing is
            stored. Sample data is not used here; only your real ticket is shown.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold text-ink-950">
                {ticket.event_title}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-400">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> {formatDate(ticket.event_starts_at)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {ticket.venue}, {ticket.city}
                </span>
              </p>
              <p className="mt-1.5 text-[11px] text-ink-400">
                {ticket.ticket_type_name} · holder {ticket.holder_name} ·{" "}
                <span className="font-mono">{ticket.code}</span>
              </p>
            </div>
            <StatusBadge
              status={ticket.status}
              label={
                ticket.status === "valid"
                  ? "Valid"
                  : ticket.status === "used"
                    ? "Admitted"
                    : "Void"
              }
            />
          </div>
        </div>

        {transferable ? (
          <div className="mt-5">
            <TransferForm ticketLabel={ticketLabel} holderName={ticket.holder_name} />
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-line bg-white p-5 text-[12px] leading-relaxed text-ink-500">
            {ticket.status !== "valid"
              ? "Only valid, unused tickets can be transferred. This ticket has already been scanned or voided."
              : "This event has already started or passed, so this ticket can no longer be transferred."}
          </div>
        )}
      </div>
    </div>
  );
}
