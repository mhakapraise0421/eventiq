"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function SendAgreementButton({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function send() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/${agreementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That agreement could not be sent.");
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <Send className="h-3.5 w-3.5" /> Send to artist
        </button>
        {error ? (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface/60 p-3">
      <p className="text-[11.5px] leading-relaxed text-ink-600">
        The artist will be able to accept this version or ask for changes. Sent versions can no
        longer be edited.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={send}>
          Confirm and send
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Back
        </button>
      </div>
      {error ? (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
