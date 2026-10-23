"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

interface TierRow {
  id: string;
  name: string;
  price_cents: number;
}

export function PriceRequestPanel({
  eventId,
  tiers,
  pendingTierIds,
}: {
  eventId: string;
  tiers: TierRow[];
  pendingTierIds: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(tiers.map((tier) => [tier.id, String(tier.price_cents / 100)])),
  );
  const [note, setNote] = useState("");
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestChange(tier: TierRow) {
    setBusyTier(tier.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/organizer/price-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          ticketTypeId: tier.id,
          newPriceCents: Math.round((Number(values[tier.id]) || 0) * 100),
          note,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not submit the price request.");
      } else {
        setMessage(`Price change for ${tier.name} submitted for approval.`);
        setNote("");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tiers.map((tier) => {
          const pending = pendingTierIds.includes(tier.id);
          return (
            <div
              key={tier.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink-900">
                {tier.name}
              </span>
              <span className="text-[10.5px] text-ink-400">
                Now ${(tier.price_cents / 100).toFixed(2)}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-ink-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input w-24 px-2 py-1.5 text-[12px]"
                  value={values[tier.id] ?? ""}
                  onChange={(e) => setValues({ ...values, [tier.id]: e.target.value })}
                  disabled={pending}
                />
              </div>
              <button
                type="button"
                onClick={() => requestChange(tier)}
                className="btn btn-outline btn-sm"
                disabled={pending || busyTier === tier.id}
              >
                <Send className="h-3 w-3" />
                {pending ? "Pending" : busyTier === tier.id ? "Sending…" : "Request"}
              </button>
            </div>
          );
        })}
      </div>
      <input
        className="input text-[12px]"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason for the price change (optional)"
      />
      {message ? <p className="text-[11px] font-semibold text-emerald-600">{message}</p> : null}
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
      <p className="text-[10px] leading-relaxed text-ink-400">
        Price changes require EventIQ approval. The current price stays active until a decision
        is made, and every request is recorded in the audit log.
      </p>
    </div>
  );
}
