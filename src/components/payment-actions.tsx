"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

export function PaymentActions({
  agreementId,
  paymentId,
  role,
}: {
  agreementId: string;
  paymentId: string;
  role: "artist" | "organizer";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "confirm" | "failed") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/${agreementId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, paymentId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That payment could not be updated.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {role === "artist" ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={pending}
          onClick={() => send("confirm")}
        >
          <Check className="h-3.5 w-3.5" /> Confirm received
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm text-rose-600"
          disabled={pending}
          onClick={() => send("failed")}
        >
          <X className="h-3.5 w-3.5" /> Mark failed
        </button>
      )}
      {error ? (
        <p className="mt-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10.5px] text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
