"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare } from "lucide-react";

export function AgreementResponse({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingAccept, setConfirmingAccept] = useState(false);

  async function send(action: "accept" | "request_changes") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/${agreementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That response could not be saved.");
        return;
      }
      setMode("idle");
      setConfirmingAccept(false);
      setNote("");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {mode === "idle" ? (
        <div className="flex flex-wrap items-center gap-2">
          {confirmingAccept ? (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pending}
                onClick={() => send("accept")}
              >
                <Check className="h-3.5 w-3.5" /> Confirm acceptance
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending}
                onClick={() => setConfirmingAccept(false)}
              >
                Back
              </button>
              <span className="text-[10.5px] text-ink-400">
                EventIQ records your acceptance but is not a law firm.
              </span>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pending}
                onClick={() => setConfirmingAccept(true)}
              >
                <Check className="h-3.5 w-3.5" /> Accept agreement
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={pending}
                onClick={() => setMode("changes")}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Request changes
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <label className="block">
            <span className="label">What needs to change?</span>
            <textarea
              className="input min-h-[64px]"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="The organizer can revise the agreement and send a new version."
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={pending}
              onClick={() => send("request_changes")}
            >
              Send request
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
