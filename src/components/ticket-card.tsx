import Link from "next/link";
import { CalendarDays, MapPin, ScanLine, Ticket as TicketIcon } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { formatDate, formatTimeRange } from "@/lib/format";
import { StatusBadge } from "./status-badge";
import { TicketQR } from "./ticket-qr";

export function TicketCard({
  ticket,
  qrValue,
  compact = false,
}: {
  ticket: Ticket;
  qrValue: string;
  compact?: boolean;
}) {
  const isUsed = ticket.status === "used";
  const isVoid = ticket.status === "void";

  return (
    <div
      className={`print-ticket overflow-hidden rounded-2xl border border-line bg-white ${
        isVoid ? "opacity-70" : ""
      }`}
    >
      <div className="relative flex items-center justify-between gap-3 overflow-hidden bg-gradient-to-r from-brand-900 via-brand-700 to-brand-500 px-5 py-3.5 text-white">
        <div className="pointer-events-none absolute -right-6 -top-10 h-24 w-24 rounded-full bg-aqua-400/25 blur-2xl" />
        <div className="relative min-w-0">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/50">
            EventIQ ticket
          </p>
          <p className="mt-0.5 truncate font-display text-[14.5px] font-semibold">
            {ticket.event_title}
          </p>
        </div>
        <span className="relative shrink-0 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[9.5px] font-semibold">
          {ticket.ticket_type_name}
        </span>
      </div>

      <div className={`grid ${compact ? "grid-cols-[1fr_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-ink-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
              {formatDate(ticket.event_starts_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-brand-600" />
              {ticket.venue}, {ticket.city}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-400">
            {formatTimeRange(ticket.event_starts_at, ticket.event_ends_at)} CAT
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-ink-400">
                Ticket holder
              </p>
              <p className="mt-0.5 truncate text-[12.5px] font-semibold text-ink-950">
                {ticket.holder_name}
              </p>
            </div>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-ink-400">
                Ticket code
              </p>
              <p className="mt-0.5 truncate font-mono text-[11.5px] font-semibold text-ink-950">
                {ticket.code}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <StatusBadge status={ticket.status} label={isUsed ? "Admitted" : isVoid ? "Void" : "Valid"} />
            {ticket.used_at ? (
              <span className="text-[10px] text-ink-400">
                {formatDate(ticket.used_at)} · {ticket.used_gate}
              </span>
            ) : (
              <span className="text-[10px] text-ink-400">Single admission</span>
            )}
          </div>

          {!compact ? (
            <div className="mt-4 flex flex-wrap gap-3 text-[9.5px] text-ink-400">
              <span className="flex items-center gap-1">
                <ScanLine className="h-3 w-3" /> Scan at the gate
              </span>
              <span className="flex items-center gap-1">
                <TicketIcon className="h-3 w-3" /> Order {ticket.order_reference}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center justify-center border-t border-dashed border-line p-4 sm:border-l sm:border-t-0">
          <TicketQR value={qrValue} size={compact ? 116 : 148} />
          <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            {isUsed ? "Already scanned" : isVoid ? "Not valid" : "Admit one"}
          </p>
        </div>
      </div>

      {!compact ? (
        <div className="flex items-center justify-between gap-2 border-t border-line bg-surface/50 px-5 py-2.5 text-[9.5px] text-ink-400">
          <span>
            Valid for one admission. Duplicate scans are rejected and logged.
          </span>
          <Link href={`/events/${ticket.event_slug}`} className="font-semibold text-brand-700">
            Event details
          </Link>
        </div>
      ) : null}
    </div>
  );
}
