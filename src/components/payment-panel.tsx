"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  Smartphone,
  Timer,
} from "lucide-react";
import { formatMoney } from "@/lib/format";

const METHODS = [
  {
    id: "ecocash",
    label: "EcoCash",
    description: "Mobile money prompt",
    icon: Smartphone,
    accent: "text-emerald-600",
  },
  {
    id: "card",
    label: "Card",
    description: "Visa or Mastercard",
    icon: CreditCard,
    accent: "text-brand-600",
  },
  {
    id: "bank",
    label: "Bank transfer",
    description: "Verified via provider",
    icon: Landmark,
    accent: "text-sky-600",
  },
];

export function PaymentPanel({
  orderId,
  totalCents,
  expiresAt,
  reference,
  phone,
}: {
  orderId: string;
  totalCents: number;
  expiresAt: string;
  reference: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState("ecocash");
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Payment could not be completed.");
        setLoading(false);
        return;
      }
      setPaid(true);
      setTimeout(() => {
        router.push(`/orders/${orderId}`);
        router.refresh();
      }, 700);
    } catch {
      setError("Network error. Your reservation is still held for a short time.");
      setLoading(false);
    }
  }

  if (secondsLeft <= 0 && !paid) {
    return (
      <div className="card p-6 text-center">
        <Timer className="mx-auto h-8 w-8 text-amber-500" />
        <p className="mt-3 font-display text-[16px] font-semibold">Reservation expired</p>
        <p className="mt-1 text-[12px] text-ink-400">
          Your tickets have been released back to the event. Start a new checkout to try again.
        </p>
        <button
          type="button"
          onClick={() => router.push("/events")}
          className="btn btn-primary btn-sm mt-5"
        >
          Browse events
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="text-[13px] font-semibold text-ink-950">Payment</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Order {reference}</p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
            secondsLeft < 300
              ? "bg-amber-50 text-amber-700"
              : "bg-surface text-ink-500"
          }`}
        >
          <Timer className="h-3 w-3" />
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>

      <div className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          Select payment method
        </p>
        <div className="mt-2.5 space-y-2">
          {METHODS.map((item) => {
            const selected = method === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  selected
                    ? "border-brand-400 bg-brand-50/50 ring-1 ring-brand-300"
                    : "border-line bg-white hover:border-ink-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-line ${item.accent}`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-[12.5px] font-semibold text-ink-950">
                    {item.label}
                  </span>
                  <span className="block text-[10.5px] text-ink-400">{item.description}</span>
                </span>
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    selected ? "border-brand-600" : "border-ink-300"
                  }`}
                >
                  {selected ? (
                    <span className="h-2 w-2 rounded-full bg-brand-600" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl bg-surface/70 px-3.5 py-3 text-[11px] leading-relaxed text-ink-500">
          {method === "ecocash"
            ? `A simulated payment prompt will be sent to ${phone || "your registered number"}. No PIN is collected or stored.`
            : method === "card"
              ? "In production you would be redirected to the provider's hosted checkout. This demo does not collect card numbers."
              : `In production the provider webhook would confirm your transfer using reference ${reference}.`}
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={pay}
          disabled={loading || paid}
          className={`btn mt-4 w-full ${paid ? "bg-emerald-600 text-white" : "btn-primary"}`}
        >
          {paid ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Payment confirmed
            </>
          ) : loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…
            </>
          ) : (
            <>Pay {formatMoney(totalCents)}</>
          )}
        </button>

        <div className="mt-4 rounded-lg border border-line px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-600">
            <Lock className="h-3 w-3" /> Payment is verified server-side
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-400">
            Tickets are issued only after a confirmed payment and an idempotent order update.
            Screenshots are never treated as proof of payment.
          </p>
        </div>
      </div>
    </div>
  );
}
