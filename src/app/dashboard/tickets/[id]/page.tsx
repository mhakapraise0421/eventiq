import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  Receipt,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTicketForUser } from "@/lib/orders";
import { signTicketCode } from "@/lib/ticket-code";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/format";
import { TicketCard } from "@/components/ticket-card";
import { PrintButton } from "@/components/print-button";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your ticket" };

function calendarStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = getTicketForUser(id, user.id);
  if (!ticket) notFound();

  const startsAt = ticket.event_starts_at || new Date().toISOString();
  const endsAt = ticket.event_ends_at || startsAt;
  const eventUpcoming = new Date(startsAt).getTime() > Date.now();
  const canReassign = ticket.status === "valid" && eventUpcoming;
  const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    ticket.event_title || "EventIQ event",
  )}&dates=${calendarStamp(startsAt)}/${calendarStamp(
    endsAt,
  )}&location=${encodeURIComponent(`${ticket.venue}, ${ticket.city}`)}`;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <div className="container-page max-w-4xl pt-6">
        <Link
          href="/dashboard/tickets"
          className="no-print inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-400 hover:text-ink-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All my tickets
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Your ticket</p>
            <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.035em]">
              {ticket.event_title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
                {formatDate(ticket.event_starts_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand-600" />
                {formatTimeRange(ticket.event_starts_at, ticket.event_ends_at)} CAT
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-brand-600" />
                {ticket.venue}, {ticket.city}
              </span>
            </div>
          </div>
          <StatusBadge
            status={ticket.status}
            label={
              ticket.status === "valid"
                ? "Valid for entry"
                : ticket.status === "used"
                  ? "Already admitted"
                  : "Void"
            }
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <TicketCard ticket={ticket} qrValue={signTicketCode(ticket.code)} />
            <div className="no-print mt-3 flex flex-wrap items-center gap-2">
              {ticket.status !== "void" ? (
                <a
                  href={`/api/tickets/${ticket.id}/pdf`}
                  className="btn btn-primary btn-sm"
                  download
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
              ) : null}
              <PrintButton label="Print ticket" />
              <Link href={`/events/${ticket.event_slug}`} className="btn btn-outline btn-sm">
                Event page <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              {canReassign ? (
                <>
                  <Link
                    href={`/dashboard/tickets/${ticket.id}/transfer`}
                    className="btn btn-outline btn-sm"
                  >
                    <UserRoundPlus className="h-3.5 w-3.5" /> Transfer
                  </Link>
                  <Link
                    href={`/dashboard/tickets/${ticket.id}/resell`}
                    className="btn btn-outline btn-sm"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Resell
                  </Link>
                </>
              ) : null}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-400">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              This QR code is signed on the server and verified at the gate. A screenshot
              cannot be used for a second admission — each ticket is valid for one scan.
            </p>
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                Entry details
              </p>
              <dl className="mt-3 space-y-2.5 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-400">Ticket holder</dt>
                  <dd className="text-right font-semibold text-ink-950">{ticket.holder_name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-400">Ticket type</dt>
                  <dd className="text-right font-semibold text-ink-950">
                    {ticket.ticket_type_name}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-400">Ticket code</dt>
                  <dd className="text-right font-mono text-[11px] font-semibold">
                    {ticket.code}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-400">Issued</dt>
                  <dd className="text-right text-ink-700">{formatDateTime(ticket.issued_at)}</dd>
                </div>
                {ticket.used_at ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-400">Scanned</dt>
                    <dd className="text-right text-ink-700">
                      {formatDateTime(ticket.used_at)}
                      {ticket.used_gate ? ` · ${ticket.used_gate}` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-3 border-t border-line pt-3">
                <Link
                  href={`/orders/${ticket.order_id}`}
                  className="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-brand-700"
                >
                  <span className="flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5" /> Order {ticket.order_reference}
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                Good to know
              </p>
              <ul className="mt-2.5 space-y-2 text-[11px] leading-relaxed text-ink-500">
                <li>Arrive early — gates usually open one hour before the start time.</li>
                <li>Bring a valid ID if the event has an age restriction.</li>
                <li>Tickets cannot be resold outside EventIQ.</li>
              </ul>
              <a
                href={calendarUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm mt-3 w-full"
              >
                <CalendarDays className="h-3.5 w-3.5" /> Add to calendar
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
