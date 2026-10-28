"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, X } from "lucide-react";

export function ArtistVerificationDecision({
  requestId,
  canVerify,
}: {
  requestId: string;
  canVerify: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function decide(decision: "verified" | "requires_info" | "rejected") {
    if (decision !== "verified" && !note.trim()) {
      setError("Add a note explaining the decision.");
      return;
    }
    setBusy(decision);
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/admin/artists/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision, note }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Could not save the decision.");
        return;
      }
      setDone("Decision saved.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        className="input text-[12px]"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Reviewer note (required for changes or rejection)"
      />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => decide("verified")}
          disabled={!!busy || !canVerify}
          title={canVerify ? undefined : "Attach at least one identity document first"}
        >
          <Check className="h-3.5 w-3.5" /> {busy === "verified" ? "Verifying…" : "Mark verified"}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => decide("requires_info")}
          disabled={!!busy}
        >
          <CircleAlert className="h-3.5 w-3.5" /> Request information
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm text-rose-600"
          onClick={() => decide("rejected")}
          disabled={!!busy}
        >
          <X className="h-3.5 w-3.5" /> Reject
        </button>
      </div>
      {!canVerify ? (
        <p className="text-[10px] text-ink-400">
          Verification requires at least one attached identity document.
        </p>
      ) : null}
      {error ? <p className="text-[10.5px] text-rose-600">{error}</p> : null}
      {done ? <p className="text-[10.5px] text-emerald-600">{done}</p> : null}
    </div>
  );
}
