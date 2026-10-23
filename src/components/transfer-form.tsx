"use client";

import { useState } from "react";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";

export function TransferForm({
  ticketLabel,
  holderName,
}: {
  ticketLabel: string;
  holderName: string;
}) {
  const [form, setForm] = useState({ name: "", contact: "", note: "" });
  const ready =
    form.name.trim().length >= 2 && form.contact.trim().length >= 5;

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="rounded-2xl border border-line bg-white p-5"
    >
      <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
        Who is this ticket going to?
      </h2>
      <p className="mt-1 text-[11.5px] text-ink-400">
        When transfers go live, the ticket is permanently reassigned: the new holder gets
        their own signed QR code and your code stops working at the gate immediately.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="label" htmlFor="recipient-name">
            Recipient full name
          </label>
          <input
            id="recipient-name"
            className="input"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="e.g. Rutendo Chikafu"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="recipient-contact">
            Recipient phone or email
          </label>
          <input
            id="recipient-contact"
            className="input"
            value={form.contact}
            onChange={(event) => setForm({ ...form, contact: event.target.value })}
            placeholder="+263 77 000 0000 or name@email.com"
            autoComplete="off"
          />
          <p className="mt-1 text-[10.5px] text-ink-400">
            They must have (or create) an EventIQ account to receive the ticket.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="recipient-note">
            Note (optional)
          </label>
          <textarea
            id="recipient-note"
            className="input min-h-[72px]"
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Anything you want to tell them…"
          />
        </div>
      </div>

      {ready ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-[11.5px] text-brand-800">
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{ticketLabel}</strong> would move from {holderName} to{" "}
            <strong>{form.name.trim()}</strong>.
          </span>
        </div>
      ) : null}

      <button type="submit" className="btn btn-primary btn-sm mt-4 w-full" disabled>
        Transfer ticket
      </button>
      <p className="mt-2 text-center text-[10.5px] text-ink-400">
        Transfers arrive in Stage 5. Nothing you enter here is sent or stored.
      </p>

      <div className="mt-4 space-y-2 rounded-xl border border-line bg-surface/70 p-4 text-[11px] leading-relaxed text-ink-500">
        <p className="flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
          One ticket, one owner. A transfer changes ownership on the server — it never
          creates a second valid QR code.
        </p>
        <p className="flex items-start gap-1.5">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
          Your access is revoked the moment the transfer completes, so you cannot use the
          ticket afterwards.
        </p>
      </div>
    </form>
  );
}
