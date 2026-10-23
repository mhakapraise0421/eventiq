"use client";

import { useState } from "react";
import { BadgeDollarSign, Info, Tag } from "lucide-react";
import { formatMoney } from "@/lib/format";

export function ResellForm({
  ticketLabel,
  faceValueCents,
}: {
  ticketLabel: string;
  faceValueCents: number;
}) {
  const suggested = faceValueCents > 0 ? faceValueCents : 1000;
  const [price, setPrice] = useState(String(Math.round(suggested / 100)));
  const parsed = Math.max(0, Math.round(Number(price) * 100) || 0);
  const withinBounds = parsed > 0 && parsed <= suggested * 1.2;
  const payout = withinBounds ? Math.round(parsed * 0.95) : 0;

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="rounded-2xl border border-line bg-white p-5"
    >
      <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
        Set your resale price
      </h2>
      <p className="mt-1 text-[11.5px] text-ink-400">
        EventIQ resale is capped at 120% of face value to keep tickets fair. When resale
        goes live, your listing is verified against the real ticket on the server.
      </p>

      <div className="mt-4">
        <label className="label" htmlFor="resale-price">
          Asking price (USD)
        </label>
        <div className="relative">
          <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            id="resale-price"
            className="input pl-9"
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="25"
            autoComplete="off"
          />
        </div>
        <p className="mt-1 text-[10.5px] text-ink-400">
          Face value for this ticket is {formatMoney(suggested)} — the maximum you can ask
          is {formatMoney(Math.round(suggested * 1.2))}.
        </p>
      </div>

      {withinBounds ? (
        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-3 text-[11.5px] text-brand-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <BadgeDollarSign className="h-3.5 w-3.5" /> Listing preview
          </p>
          <p className="mt-1">
            <strong>{ticketLabel}</strong> at {formatMoney(parsed)} · you would receive
            approximately {formatMoney(payout)} after the 5% resale fee (once a buyer pays).
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11.5px] text-amber-800">
          Enter a price between $0.01 and {formatMoney(Math.round(suggested * 1.2))}.
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-sm mt-4 w-full" disabled>
        List ticket for resale
      </button>
      <p className="mt-2 text-center text-[10.5px] text-ink-400">
        Resale arrives in Stage 5. This preview creates no listing and no payment.
      </p>

      <div className="mt-4 flex items-start gap-1.5 rounded-xl border border-line bg-surface/70 p-4 text-[11px] leading-relaxed text-ink-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
        When live: the ticket is held by EventIQ while listed, your QR is suspended, and
        the buyer is issued a fresh signed ticket. Money reaches you after the event.
      </div>
    </form>
  );
}
