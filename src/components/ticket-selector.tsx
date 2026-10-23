"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Lock, Minus, Plus, Ticket } from "lucide-react";
import type { TicketType } from "@/lib/types";
import { SERVICE_FEE_RATE, formatMoney } from "@/lib/format";

interface Props {
  eventId: string;
  eventSlug: string;
  tiers: TicketType[];
  isAuthenticated: boolean;
  salesClosed: boolean;
}

export function TicketSelector({
  eventId,
  eventSlug,
  tiers,
  isAuthenticated,
  salesClosed,
}: Props) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let count = 0;
    for (const tier of tiers) {
      const qty = quantities[tier.id] || 0;
      subtotal += qty * tier.price_cents;
      count += qty;
    }
    const fee = Math.round(subtotal * SERVICE_FEE_RATE);
    return { subtotal, fee, total: subtotal + fee, count };
  }, [quantities, tiers]);

  const soldOut = tiers.every((t) => t.sold >= t.capacity);

  function change(tier: TicketType, delta: number) {
    setError("");
    setQuantities((prev) => {
      const current = prev[tier.id] || 0;
      const max = Math.min(tier.max_per_order, tier.capacity - tier.sold, 10);
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [tier.id]: next };
    });
  }

  async function checkout() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/events/${eventSlug}`)}`);
      return;
    }
    if (totals.count === 0) {
      setError("Select at least one ticket to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          items: Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not create your order.");
        setSubmitting(false);
        return;
      }
      router.push(data.free ? `/orders/${data.orderId}` : `/checkout/${data.orderId}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (salesClosed || soldOut) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
          <Ticket className="h-4 w-4 text-brand-600" /> Tickets
        </div>
        <div className="mt-4 rounded-xl bg-surface px-4 py-6 text-center">
          <p className="font-display text-[15px] font-semibold">
            {soldOut ? "Sold out" : "Ticket sales have closed"}
          </p>
          <p className="mt-1 text-[12px] text-ink-400">
            {soldOut
              ? "Every tier for this event has been allocated."
              : "This event is no longer selling tickets online."}
          </p>
          <Link href="/events" className="btn btn-outline btn-sm mt-4">
            Browse other events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-950">
            <Ticket className="h-4 w-4 text-brand-600" /> Choose your tickets
          </div>
          <span className="text-[11px] font-medium text-emerald-600">On sale</span>
        </div>
        <p className="mt-1 text-[11.5px] text-ink-400">
          Prices in USD. Max 10 tickets per order. Tiers may limit quantities.
        </p>
      </div>

      <div className="divide-y divide-line">
        {tiers.map((tier) => {
          const remaining = Math.max(0, tier.capacity - tier.sold);
          const qty = quantities[tier.id] || 0;
          const unavailable = remaining <= 0;
          const max = Math.min(tier.max_per_order, remaining, 10);
          const percentage = tier.capacity > 0 ? (tier.sold / tier.capacity) * 100 : 100;

          return (
            <div key={tier.id} className={`px-5 py-4 ${unavailable ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink-950">{tier.name}</p>
                  {tier.description ? (
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-400">
                      {tier.description}
                    </p>
                  ) : null}
                  {tier.perks ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tier.perks.split("·").map((perk) => (
                        <span
                          key={perk}
                          className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-500"
                        >
                          {perk.trim()}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="shrink-0 text-right text-[14px] font-semibold text-ink-950">
                  {tier.price_cents === 0 ? "Free" : formatMoney(tier.price_cents)}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${percentage > 85 ? "bg-amber-500" : "bg-brand-500"}`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-ink-400">
                      {unavailable
                        ? "Sold out"
                        : percentage > 80
                          ? `${remaining} left`
                          : "Available"}
                    </span>
                  </div>
                </div>
                {unavailable ? (
                  <span className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-semibold text-ink-400">
                    Sold out
                  </span>
                ) : (
                  <div className="flex items-center gap-1 rounded-lg border border-line p-1">
                    <button
                      type="button"
                      onClick={() => change(tier, -1)}
                      disabled={qty <= 0}
                      aria-label={`Remove one ${tier.name} ticket`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-500 transition hover:bg-surface disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-[12px] font-semibold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => change(tier, 1)}
                      disabled={qty >= max}
                      aria-label={`Add one ${tier.name} ticket`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-500 transition hover:bg-surface disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line bg-surface/50 px-5 py-4">
        {totals.count > 0 ? (
          <div className="space-y-1.5 text-[12.5px]">
            <div className="flex justify-between text-ink-500">
              <span>Subtotal ({totals.count} ticket{totals.count === 1 ? "" : "s"})</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-500">
              <span>Service fee (5%)</span>
              <span>{formatMoney(totals.fee)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-[14px] font-semibold text-ink-950">
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-ink-400">
            Select your tickets to see the total, including the disclosed 5% service fee.
          </p>
        )}

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={checkout}
          disabled={submitting || totals.count === 0}
          className="btn btn-primary mt-4 w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Reserving tickets…
            </>
          ) : isAuthenticated ? (
            totals.total === 0 ? (
              "Get free tickets"
            ) : (
              "Continue to checkout"
            )
          ) : (
            "Sign in to buy tickets"
          )}
        </button>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-ink-400">
          <Lock className="h-3 w-3" /> Secure checkout · Your tickets are reserved for 20 minutes
        </p>
        <p className="mt-1 text-center text-[10px] text-ink-300">
          Demo environment: payments are simulated. No card details are collected.
        </p>
      </div>
    </div>
  );
}
