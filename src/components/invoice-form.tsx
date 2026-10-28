"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvoiceForm({
  agreementId,
  today,
  maxCents,
  suggestedCents,
}: {
  agreementId: string;
  today: string;
  maxCents: number;
  suggestedCents: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    suggestedCents > 0 ? (suggestedCents / 100).toFixed(2) : "",
  );
  const [description, setDescription] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/agreements/${agreementId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", amount, description, dueOn }),
      });
      const data = (await res.json()) as { error?: string; number?: string };
      if (!res.ok) {
        setError(data.error || "That invoice could not be created.");
        return;
      }
      setDescription("");
      setDueOn("");
      setMessage(`Invoice ${data.number || ""} issued.`.trim());
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
          <span className="label">Invoice amount (USD)</span>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={(maxCents / 100).toString()}
            required
          />
        </label>
        <label className="block">
          <span className="label">Due date</span>
          <input
            type="date"
            className="input"
            min={today}
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="label">Description</span>
        <input
          className="input"
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Performance fee — Zim Fest 2026"
          required
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          Issue invoice
        </button>
        <span className="text-[10.5px] leading-relaxed text-ink-400">
          Numbers are allocated on the server. Invoices here are records, not tax documents.
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
