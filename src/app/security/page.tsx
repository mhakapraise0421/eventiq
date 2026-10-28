import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert, KeyRound, Laptop, ShieldCheck } from "lucide-react";
import { getCurrentSessionId, getCurrentUser, listSessions } from "@/lib/auth";
import { mfaPolicy, mfaStatus, roleRequiresMfa } from "@/lib/mfa";
import { homeForRole } from "@/lib/routes";
import { ConsoleHeader } from "@/components/console-header";
import { MfaEnrollForm } from "@/components/mfa-enroll-form";
import { MfaDisablePanel } from "@/components/mfa-disable-panel";
import { SessionManager } from "@/components/session-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Security & sessions" };

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fsecurity");

  const [status, sessionId, sessions] = await Promise.all([
    Promise.resolve(mfaStatus(user.id)),
    getCurrentSessionId(),
    Promise.resolve(listSessions(user.id)),
  ]);
  const required = roleRequiresMfa(user.role);
  const policy = mfaPolicy();
  const recoveryHint =
    status.enabled && status.recoveryCodesRemaining <= 2
      ? "You have very few recovery codes left. Ask support to re-issue a set."
      : null;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Account security"
        title="Security & sessions"
        description="Protect your sign-in with a second factor, review where your account is signed in and end sessions you do not recognise."
        actions={
          <Link href={homeForRole(user.role)} className="btn btn-outline btn-sm">
            Back to my console
          </Link>
        }
      />

      <div className="container-page pt-6">
        {required && !status.enabled ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-[12.5px] font-semibold text-amber-900">
                Two-factor authentication is required for your role
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800">
                This account can reach staff consoles. Set up an authenticator below to continue.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> Two-factor authentication
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
                A 6-digit code from your authenticator app is required at sign-in. Codes are
                checked on the server; EventIQ never stores or logs them.
              </p>
              <div className="mt-4">
                {status.enabled ? (
                  <MfaDisablePanel
                    confirmedAt={status.confirmedAt}
                    recoveryCodesRemaining={status.recoveryCodesRemaining}
                  />
                ) : (
                  <MfaEnrollForm mode="session" />
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
                <Laptop className="h-4 w-4 text-brand-600" /> Active sessions
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
                {sessions.length} active session{sessions.length === 1 ? "" : "s"}. Revoking a
                session signs that device out immediately.
              </p>
              <div className="mt-2">
                <SessionManager sessions={sessions} currentId={sessionId} />
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
                <KeyRound className="h-3.5 w-3.5 text-brand-600" /> Password
              </h2>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                Change your password from profile settings. Changing it signs out every other
                device automatically.
              </p>
              <Link href="/dashboard/profile" className="btn btn-outline btn-sm mt-3">
                Open profile settings
              </Link>
            </section>

            <section className="rounded-2xl border border-line bg-surface/70 p-4">
              <p className="text-[11.5px] font-semibold text-ink-900">Keeping your account safe</p>
              <ul className="mt-2 space-y-1.5 text-[10.5px] leading-relaxed text-ink-500">
                <li>· EventIQ never asks for a password or a code by phone, email or WhatsApp.</li>
                <li>· Recovery codes work once each. Keep them somewhere offline.</li>
                <li>· If a device is lost, revoke its session here and change your password.</li>
                {recoveryHint ? <li className="text-amber-700">· {recoveryHint}</li> : null}
              </ul>
            </section>

            {policy === "off" ? (
              <p className="rounded-xl border border-line bg-white px-4 py-3 text-[10.5px] leading-relaxed text-ink-400">
                This environment does not require two-factor authentication. Staff deployments can
                enforce it with <span className="font-mono">MFA_ENFORCEMENT=staff</span> (or
                <span className="font-mono"> all</span>).
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
