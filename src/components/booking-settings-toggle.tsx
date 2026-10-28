"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BookingSettingsToggle({ accepting }: { accepting: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(accepting);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !value;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/artist/booking-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepting: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That setting could not be saved.");
        return;
      }
      setValue(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          value
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${value ? "bg-emerald-500" : "bg-zinc-400"}`} />
        {value ? "Accepting booking requests" : "Booking requests paused"}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={toggle}
        disabled={pending}
      >
        {pending ? "Saving…" : value ? "Pause requests" : "Resume requests"}
      </button>
      {error ? <span className="text-[10.5px] text-rose-600">{error}</span> : null}
    </div>
  );
}
