"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecordPaymentForm({
  agreementId,
  today,
  invoices,
  remainingCents,
}: {
  agreementId: string;
  today: string;
  invoices: { id: string; number: string; balanceCents: number }[];
  remainingCents: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/agreements/${agreementId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record",
          amount,
          paidOn,
          method,
          reference,
          note,
          invoiceId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That payment could not be recorded.");
        return;
      }
      setAmount("");
      setReference("");
      setNote("");
      setInvoiceId("");
      setMessage("Payment recorded. It counts once the artist confirms it.");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Amount (USD)</span>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={remainingCents > 0 ? (remainingCents / 100).toString() : "0"}
            required
          />
        </label>
        <label className="block">
          <span className="label">Date paid</span>
          <input
            type="date"
            className="input"
            max={today}
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">Method</span>
          <select
            className="input"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="mobile_money">Mobile money</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Reference (optional)</span>
          <input
            className="input"
            maxLength={100}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Transaction or receipt reference"
          />
        </label>
      </div>

      {invoices.length ? (
        <label className="block">
          <span className="label">Apply to invoice (optional)</span>
          <select
            className="input"
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
          >
            <option value="">No specific invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number} — {(invoice.balanceCents / 100).toFixed(2)} outstanding
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className="label">Note (optional)</span>
        <textarea
          className="input min-h-[52px]"
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          Record payment
        </button>
        <span className="text-[10.5px] leading-relaxed text-ink-400">
          This logs a payment the organizer made. It is not processed by EventIQ and only counts as
          received after the artist confirms it.
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
