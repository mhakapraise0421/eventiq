"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from "lucide-react";

export function MfaVerifyForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "totp" ? { code } : { recoveryCode: code }),
      });
      const data = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) {
        setError(data.error || "Could not verify that code.");
        setLoading(false);
        return;
      }
      router.push(nextPath || data.redirect || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="eyebrow">Step 2 of 2</p>
      <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.035em]">
        Confirm it&apos;s you
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
        {mode === "totp"
          ? "Enter the 6-digit code from your authenticator app. Codes change every 30 seconds."
          : "Enter one of the recovery codes you saved when you set up two-factor authentication. Each code works once."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="mfa-code" className="label">
            {mode === "totp" ? "Authenticator code" : "Recovery code"}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300">
              {mode === "totp" ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
            </span>
            <input
              id="mfa-code"
              className="input pl-10 font-mono text-[15px] tracking-[0.18em]"
              value={code}
              onChange={(event) =>
                setCode(
                  mode === "totp"
                    ? event.target.value.replace(/\D/g, "").slice(0, 6)
                    : event.target.value.toUpperCase().slice(0, 14),
                )
              }
              inputMode={mode === "totp" ? "numeric" : "text"}
              autoComplete="one-time-code"
              autoFocus
              required
              placeholder={mode === "totp" ? "000000" : "XXXX-XXXX-XXXX"}
            />
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
            </>
          ) : (
            "Verify and continue"
          )}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <button
          type="button"
          className="font-semibold text-brand-700 hover:underline"
          onClick={() => {
            setMode(mode === "totp" ? "recovery" : "totp");
            setCode("");
            setError("");
          }}
        >
          {mode === "totp" ? "Use a recovery code instead" : "Use my authenticator instead"}
        </button>
        <Link href="/login" className="text-ink-400 hover:text-ink-700">
          Start over
        </Link>
      </div>

      <p className="mt-6 rounded-lg border border-line bg-surface/60 px-3 py-2 text-[11px] leading-relaxed text-ink-400">
        Lost both your authenticator and recovery codes? Contact support. EventIQ staff will never
        ask you for a code over phone, email or WhatsApp.
      </p>
    </div>
  );
}
