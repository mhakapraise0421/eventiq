"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function SubmitEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not submit this event.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={submit} className="btn btn-primary btn-sm" disabled={submitting}>
        <Send className="h-3.5 w-3.5" /> {submitting ? "Submitting…" : "Submit for approval"}
      </button>
      {error ? <p className="text-[10.5px] text-rose-600">{error}</p> : null}
    </div>
  );
}
