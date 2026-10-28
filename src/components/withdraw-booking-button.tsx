"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WithdrawBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (!window.confirm("Withdraw this booking request? The artist will no longer see it.")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw", bookingId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "The request could not be withdrawn.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={withdraw}
        disabled={pending}
        className="text-[11px] font-semibold text-ink-500 underline-offset-2 hover:text-rose-600 hover:underline"
      >
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
      {error ? <p className="mt-1 text-[10.5px] text-rose-600">{error}</p> : null}
    </>
  );
}
