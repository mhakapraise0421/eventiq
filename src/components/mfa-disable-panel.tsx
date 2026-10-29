"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

export function MfaDisablePanel({
  confirmedAt,
  recoveryCodesRemaining,
  canDisable = true,
}: {
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
  canDisable?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    if (
      !window.confirm(
        "Turn off two-factor authentication? Only your password will protect this account afterwards.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/security/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", password, code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not disable two-factor authentication.");
        return;
      }
      setPassword("");
      setCode("");
      setOpen(false);
      setDone("Two-factor authentication is off. Other sessions were signed out.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Enabled
        </span>
        <span className="text-[11px] text-ink-400">
          Since {confirmedAt ? new Date(confirmedAt).toLocaleDateString("en-GB", { timeZone: "Africa/Harare" }) : "—"}
          {" · "}
          {recoveryCodesRemaining} recovery code{recoveryCodesRemaining === 1 ? "" : "s"} remaining
        </span>
      </div>

      {recoveryCodesRemaining <= 2 ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          You are running low on recovery codes. Keep your authenticator app somewhere safe, or
          contact support to re-issue codes before you run out.
        </p>
      ) : null}

      {!canDisable ? (
        <p className="mt-3 rounded-lg border border-line bg-surface/60 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          Two-factor authentication is required for your account type, so it can&apos;t be turned
          off here. If you lose your authenticator, sign in with a recovery code, then ask support
          to re-issue a new set.
        </p>
      ) : null}

      {done ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> {done}
        </p>
      ) : null}

      {open && canDisable ? (
        <form onSubmit={disable} className="mt-3 space-y-2 rounded-xl border border-line bg-surface/50 p-3">
          <p className="text-[11px] font-semibold text-ink-700">
            Confirm with your password and a current code (or a recovery code).
          </p>
          <input
            className="input text-[12px]"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            required
          />
          <input
            className="input font-mono text-[12px] tracking-[0.12em]"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 14))}
            placeholder="000000 or recovery code"
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ghost btn-sm text-rose-600" disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
              {busy ? "Disabling…" : "Turn off two-factor"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setCode("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : canDisable ? (
        <button
          type="button"
          className="btn btn-outline btn-sm mt-3"
          onClick={() => {
            setOpen(true);
            setDone("");
          }}
        >
          <KeyRound className="h-3.5 w-3.5" /> Change or disable two-factor
        </button>
      ) : null}

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-600">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}
