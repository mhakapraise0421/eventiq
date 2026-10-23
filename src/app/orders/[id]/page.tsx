import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Receipt,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getOrderForUser,
  getOrderItems,
  getTicketsForOrder,
  releaseExpiredOrders,
} from "@/lib/orders";
import {
  formatDate,
  formatDateTime,
  formatMoneyExact,
  formatTime,
  ORDER_STATUS_LABEL,
} from "@/lib/format";
import { signTicketCode } from "@/lib/ticket-code";
import { TicketCard } from "@/components/ticket-card";
import { PrintButton } from "@/components/print-button";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order" };

const methodLabel: Record<string, string> = {
  ecocash: "EcoCash",
  card: "Card",
  bank: "Bank transfer",
  free: "Free tickets",
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  releaseExpiredOrders();
  const order = getOrderForUser(id, user.id);
  if (!order) notFound();

  if (order.status === "pending") {
    if (new Date(order.expires_at).getTime() < Date.now()) {
      // Expired orders fall through to the status view below.
    } else {
      redirect(`/checkout/${order.id}`);
    }
  }

  const items = getOrderItems(order.id);
  const tickets = getTicketsForOrder(order.id);
  const paid = order.status === "paid" || order.status === "partially_refunded";
  const refunded = order.status === "refunded";

  return (
    <div className="container-page max-w-4xl py-8">
      <div className="rounded-2xl border border-line bg-white p-6 text-center">
        <span
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            paid ? "bg-emerald-50 text-emerald-600" : refunded ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
          }`}
        >
          {paid ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : refunded ? (
            <Clock className="h-6 w-6" />
          ) : (
            <XCircle className="h-6 w-6" />
          )}
        </span>
        <h1 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.03em]">
          {paid
            ? "You're going!"
            : refunded
              ? "Order refunded"
              : ORDER_STATUS_LABEL[order.status] || "Order unavailable"}
        </h1>
        <p className="mt-1 text-[12.5px] text-ink-500">
          {paid
            ? `Your tickets for ${order.event_title} are ready.`
            : refunded
              ? "The refund has been recorded against this order."
              : "This order did not complete. You can start a new checkout from the event page."}
        </p>
        <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[10.5px] text-ink-500">
          <span className="font-semibold text-ink-800">{order.reference}</span>
          <span className="text-ink-300">·</span>
          <StatusBadge status={order.status} kind="order" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-100 to-aqua-300/30">
            {order.event_cover ? (
              <Image
                src={order.event_cover}
                alt={order.event_title || "Event"}
                fill
                unoptimized
                sizes="80px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <Link
              href={`/events/${order.event_slug}`}
              className="truncate font-display text-[15px] font-semibold hover:text-brand-700"
            >
              {order.event_title}
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {formatDate(order.event_starts_at)} ·{" "}
                {formatTime(order.event_starts_at)}
              </span>
            </p>
          </div>
        </div>
        <Link href={`/events/${order.event_slug}`} className="btn btn-outline btn-sm">
          Event page <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {tickets.length ? (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[19px] font-semibold tracking-[-0.025em]">
                Your tickets
              </h2>
              <p className="mt-0.5 text-[11.5px] text-ink-400">
                {tickets.length} ticket{tickets.length === 1 ? "" : "s"} · show the QR at the gate
              </p>
            </div>
            <div className="no-print flex items-center gap-2">
              <PrintButton />
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                qrValue={signTicketCode(ticket.code)}
              />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-ink-400">
            <ShieldCheck className="h-3 w-3" /> Each QR code is signed and validated on the
            server. A screenshot cannot admit a second guest.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-950">
            <Receipt className="h-4 w-4 text-brand-600" /> Receipt
          </p>
          <div className="mt-3 space-y-2 text-[12px]">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-ink-500">
                <span>
                  {item.quantity} × {item.ticket_type_name}
                </span>
                <span>{formatMoneyExact(item.quantity * item.unit_price_cents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 text-ink-500">
              <span>Service fee</span>
              <span>{formatMoneyExact(order.fee_cents)}</span>
            </div>
            <div className="flex justify-between font-semibold text-ink-950">
              <span>Total paid</span>
              <span>{formatMoneyExact(order.total_cents)}</span>
            </div>
            {order.refunded_cents > 0 ? (
              <div className="flex justify-between text-amber-700">
                <span>Refunded</span>
                <span>-{formatMoneyExact(order.refunded_cents)}</span>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-[10.5px] text-ink-400">
            {methodLabel[order.payment_method || ""] || order.payment_method || "—"} ·{" "}
            {order.paid_at ? formatDateTime(order.paid_at) : "Not paid"}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-[12.5px] font-semibold text-ink-950">Need help?</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
            Bring a valid ID if the event has an age limit. If you cannot access your ticket
            at the gate, support can look it up using your order reference.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/tickets" className="btn btn-outline btn-sm">
              All my tickets
            </Link>
            <Link href="/policies/customer-service" className="btn btn-ghost btn-sm">
              Customer support
            </Link>
          </div>
          <p className="mt-3 flex items-center gap-1 text-[10px] text-ink-400">
            <MapPin className="h-3 w-3" /> {order.event_title} ·{" "}
            {order.event_starts_at ? formatDate(order.event_starts_at) : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
