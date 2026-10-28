"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

type Mode = "idle" | "decline" | "cancel";

export function BookingActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "requested" && status !== "accepted") return null;

  async function send(action: "accept" | "decline" | "cancel", noteValue?: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: noteValue }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That change could not be saved.");
        return;
      }
      setMode("idle");
      setNote("");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {mode === "idle" ? (
        <div className="flex flex-wrap items-center gap-2">
          {status === "requested" ? (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pending}
                onClick={() => send("accept")}
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={pending}
                onClick={() => setMode("decline")}
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-sm text-rose-600"
              disabled={pending}
              onClick={() => setMode("cancel")}
            >
              Cancel booking
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <label className="block">
            <span className="label">
              {mode === "decline" ? "Reason for declining" : "Reason for cancelling"}
            </span>
            <textarea
              className="input min-h-[70px]"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Let the organizer know why, so they can plan."
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm text-rose-600"
              disabled={pending}
              onClick={() => send(mode, note)}
            >
              {mode === "decline" ? "Confirm decline" : "Confirm cancellation"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending}
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
