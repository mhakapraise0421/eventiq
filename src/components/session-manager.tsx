"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, LogOut, MonitorSmartphone, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export interface SessionView {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return platform ? `${browser} on ${platform}` : browser;
}

export function SessionManager({
  sessions,
  currentId,
}: {
  sessions: SessionView[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function revoke(sessionId: string) {
    if (!window.confirm("Sign this session out? That device will need to sign in again.")) return;
    setBusy(sessionId);
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/security/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", sessionId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not sign that session out.");
        return;
      }
      setDone("Session signed out.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function revokeOthers() {
    if (!window.confirm("Sign out every other device? They will need to sign in again.")) return;
    setBusy("others");
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/security/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke-others" }),
      });
      const data = (await response.json()) as { error?: string; revoked?: number };
      if (!response.ok) {
        setError(data.error || "Could not sign out other sessions.");
        return;
      }
      setDone(
        data.revoked
          ? `${data.revoked} other session${data.revoked === 1 ? "" : "s"} signed out.`
          : "No other sessions were active.",
      );
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {sessions.map((session) => {
          const isCurrent = session.id === currentId;
          return (
            <li key={session.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-500">
                {isCurrent ? <Laptop className="h-4 w-4" /> : <MonitorSmartphone className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-ink-900">
                  {deviceLabel(session.user_agent)}
                  {isCurrent ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-brand-700">
                      This device
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[10.5px] text-ink-400">
                  {session.ip || "IP unavailable"} · Last active {formatDateTime(session.last_seen_at)}
                </p>
                <p className="text-[10.5px] text-ink-400">
                  Signed in {formatDateTime(session.created_at)} · Expires{" "}
                  {formatDateTime(session.expires_at)}
                </p>
              </div>
              {!isCurrent ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-600 disabled:opacity-50"
                  onClick={() => revoke(session.id)}
                  disabled={!!busy}
                >
                  <LogOut className="h-3 w-3" /> {busy === session.id ? "Signing out…" : "Revoke"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={revokeOthers}
          disabled={!!busy}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {busy === "others" ? "Signing out…" : "Sign out other devices"}
        </button>
        {done ? <p className="text-[11px] font-semibold text-emerald-600">{done}</p> : null}
      </div>
      {error ? <p className="mt-2 text-[11px] text-rose-600">{error}</p> : null}
      <p className="mt-3 text-[10.5px] leading-relaxed text-ink-400">
        Sessions expire automatically after 7 days. Signing out here revokes the session on the
        server, not just in this browser.
      </p>
    </div>
  );
}
