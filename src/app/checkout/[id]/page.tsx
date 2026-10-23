import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrderForUser, getOrderItems, releaseExpiredOrders } from "@/lib/orders";
import {
  formatDate,
  formatMoney,
  formatMoneyExact,
  formatTime,
  ORDER_STATUS_LABEL,
} from "@/lib/format";
import { PaymentPanel } from "@/components/payment-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  releaseExpiredOrders();
  const order = getOrderForUser(id, user.id);
  if (!order) notFound();

  if (order.status === "paid" || order.status === "partially_refunded") {
    redirect(`/orders/${order.id}`);
  }

  const items = getOrderItems(order.id);
  const expired =
    order.status === "expired" ||
    (order.status === "pending" && new Date(order.expires_at).getTime() < Date.now());

  return (
    <div className="container-page max-w-5xl py-8">
      <Link
        href={order.event_slug ? `/events/${order.event_slug}` : "/events"}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-400 hover:text-ink-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to event
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Secure checkout</p>
          <h1 className="mt-2 font-display text-[30px] font-semibold tracking-[-0.035em]">
            Complete your order
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-400">
            Order {order.reference} · {formatDate(order.created_at)}
          </p>
        </div>
        <span className="badge bg-amber-50 text-amber-700">
          {expired ? "Reservation expired" : "Tickets held for 20 minutes"}
        </span>
      </div>

      {order.status !== "pending" || expired ? (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700">
          This order is {ORDER_STATUS_LABEL[order.status] || order.status}. Start a new
          checkout from the event page if you still want tickets.
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="flex gap-4 p-4">
              <div className="relative h-[86px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-100 to-aqua-300/40">
                {order.event_cover ? (
                  <Image
                    src={order.event_cover}
                    alt={order.event_title || "Event"}
                    fill
                    unoptimized
                    sizes="112px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Event
                </p>
                <p className="mt-1 font-display text-[17px] font-semibold leading-tight">
                  {order.event_title}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-400">
                  <CalendarDays className="h-3 w-3" /> {formatDate(order.event_starts_at)} ·{" "}
                  {formatTime(order.event_starts_at)}
                </p>
              </div>
            </div>
            <div className="border-t border-line px-4 py-3">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-ink-400">
                    <th className="pb-2 text-left font-semibold">Ticket</th>
                    <th className="pb-2 text-center font-semibold">Qty</th>
                    <th className="pb-2 text-right font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-line/70">
                      <td className="py-2.5">
                        <p className="font-semibold text-ink-900">{item.ticket_type_name}</p>
                        {item.perks ? (
                          <p className="mt-0.5 text-[10.5px] text-ink-400">{item.perks}</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-center">{item.quantity}</td>
                      <td className="py-2.5 text-right">
                        {formatMoneyExact(item.unit_price_cents * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 border-t border-line bg-surface/40 px-4 py-3 text-[12.5px]">
              <div className="flex justify-between text-ink-500">
                <span>Subtotal</span>
                <span>{formatMoneyExact(order.subtotal_cents)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Service fee (5%)</span>
                <span>{formatMoneyExact(order.fee_cents)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-[14px] font-semibold text-ink-950">
                <span>Total due</span>
                <span>{formatMoneyExact(order.total_cents)}</span>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Ticket holder
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-[11px] font-semibold text-white">
                {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div>
                <p className="text-[12.5px] font-semibold text-ink-950">{user.name}</p>
                <p className="text-[11px] text-ink-400">{user.email}</p>
              </div>
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-ink-400">
              Every ticket in this order is issued to this account. QR codes are unique and
              valid for a single admission.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                icon: ShieldCheck,
                title: "Payment confirmed server-side",
                text: "Tickets are only issued after verified payment.",
              },
              {
                icon: Ticket,
                title: "Instant QR delivery",
                text: "Your tickets appear in your account immediately.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-line bg-white p-3.5">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                  <item.icon className="h-3.5 w-3.5 text-brand-600" /> {item.title}
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <PaymentPanel
            orderId={order.id}
            totalCents={order.total_cents}
            expiresAt={order.expires_at}
            reference={order.reference}
            phone={user.phone}
          />
          <p className="mt-3 text-center text-[10.5px] text-ink-400">
            Need help?{" "}
            <Link href="/policies/customer-service" className="underline hover:text-ink-700">
              Contact customer support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
