import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "./logo";

export function AuthShell({
  children,
  eyebrow,
  title,
  subtitle,
  footer,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  footer?: ReactNode;
}) {
  return (
    <div className="container-page py-10">
      <div className="grid overflow-hidden rounded-[26px] border border-line bg-white shadow-[0_20px_60px_rgba(8,8,13,0.06)] lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-aqua-500/20 blur-3xl" />
          <div className="relative">
            <Logo variant="light" tagline />
            <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.16em] text-aqua-300">
              {eyebrow}
            </p>
            <h2 className="mt-3 max-w-md font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-white/55">
              {subtitle}
            </p>
          </div>

          <div className="relative mt-10 space-y-3">
            {[
              {
                icon: ShieldCheck,
                title: "Server-side authorization",
                text: "Roles and event access are enforced on every request.",
              },
              {
                icon: ScanLine,
                title: "One ticket, one entry",
                text: "Duplicate QR scans are rejected and logged at the gate.",
              },
              {
                icon: BadgeCheck,
                title: "Verified organizers",
                text: "Applications and event changes are reviewed before publishing.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3"
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-aqua-300" />
                <div>
                  <p className="text-[12px] font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-8 flex items-center gap-2 text-[11px] text-white/35">
            <Sparkles className="h-3.5 w-3.5" />
            Zimbabwe-first · Built for organizers, gate staff and attendees
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="lg:hidden">
            <Logo tagline />
          </div>
          <div className="mt-6 lg:mt-0">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
      <p className="mt-5 text-center text-[11px] text-ink-400">
        By continuing you agree to the{" "}
        <Link href="/policies/terms" className="underline hover:text-ink-700">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/policies/privacy" className="underline hover:text-ink-700">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
