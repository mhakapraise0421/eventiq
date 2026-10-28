"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  QrCode,
  ShieldCheck,
} from "lucide-react";

interface SetupData {
  secret: string;
  otpauth: string;
  qr: string;
}

export function MfaEnrollForm({
  mode,
  nextPath,
}: {
  mode: "challenge" | "session";
  nextPath?: string;
}) {
  const router = useRouter();
  const endpoint = mode === "challenge" ? "/api/auth/mfa/enroll" : "/api/security/mfa";
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [redirectTo, setRedirectTo] = useState("");
  const [copied, setCopied] = useState<"secret" | "codes" | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setBusy("start");
      setError("");
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        const data = (await response.json()) as SetupData & { error?: string };
        if (!response.ok) {
          if (!cancelled) setError(data.error || "Could not start setup.");
          return;
        }
        if (!cancelled) setSetup({ secret: data.secret, otpauth: data.otpauth, qr: data.qr });
      } catch {
        if (!cancelled) setError("Network error. Refresh the page to try again.");
      } finally {
        if (!cancelled) setBusy("");
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setBusy("confirm");
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      });
      const data = (await response.json()) as {
        error?: string;
        recoveryCodes?: string[];
        redirect?: string;
      };
      if (!response.ok) {
        setError(data.error || "Could not confirm that code.");
        return;
      }
      setRecoveryCodes(data.recoveryCodes || []);
      setRedirectTo(data.redirect || "");
      setCode("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string, target: "secret" | "codes") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  if (recoveryCodes.length) {
    return (
      <div>
        <p className="eyebrow">Two-factor enabled</p>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.035em]">
          Save your recovery codes
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          Each code signs you in once if you lose your authenticator app. Store them somewhere
          private — they will not be shown again.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface/60 p-3 font-mono text-[13px] tracking-[0.08em]">
          {recoveryCodes.map((value) => (
            <span key={value} className="rounded-md bg-white px-2 py-1.5 text-center">
              {value}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm mt-3"
          onClick={() => copy(recoveryCodes.join("\n"), "codes")}
        >
          {copied === "codes" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "codes" ? "Copied" : "Copy all codes"}
        </button>
        <button
          type="button"
          className="btn btn-primary mt-4 w-full"
          onClick={() => {
            if (mode === "challenge") {
              router.push(nextPath || redirectTo || "/dashboard");
            } else {
              router.refresh();
              setRecoveryCodes([]);
            }
          }}
        >
          {mode === "challenge" ? "Continue to EventIQ" : "I have saved my codes"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">{mode === "challenge" ? "Required for staff access" : "Account security"}</p>
      <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.035em]">
        Set up two-factor authentication
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
        Staff consoles and approvals require a second factor. Scan the QR code with Google
        Authenticator, Authy, 1Password or any TOTP app, then enter the 6-digit code.
      </p>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      {!setup ? (
        <div className="mt-6 flex items-center gap-2 text-[12px] text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing your setup key…
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-start">
            {setup.qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={setup.qr}
                alt="QR code for your authenticator app"
                className="h-40 w-40 rounded-lg border border-line"
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-surface">
                <QrCode className="h-8 w-8 text-ink-300" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                Or enter this key manually
              </p>
              <p className="mt-1 break-all font-mono text-[13px] tracking-[0.06em] text-ink-900">
                {setup.secret}
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2"
                onClick={() => copy(setup.secret, "secret")}
              >
                {copied === "secret" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === "secret" ? "Copied" : "Copy key"}
              </button>
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
                EventIQ staff will never ask you to share this key or a code.
              </p>
            </div>
          </div>

          <form onSubmit={confirm} className="mt-4 space-y-3">
            <div>
              <label htmlFor="enroll-code" className="label">
                6-digit code from your app
              </label>
              <input
                id="enroll-code"
                className="input font-mono text-[15px] tracking-[0.18em]"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={busy === "confirm" || code.length !== 6}
            >
              {busy === "confirm" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Turn on two-factor authentication
                </>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
