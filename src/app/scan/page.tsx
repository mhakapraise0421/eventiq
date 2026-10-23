import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, ScanLine, ShieldCheck, UsersRound } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { getAssignedEventsWithStats, getScanCounts } from "@/lib/gate";
import { listEventsForAdmin } from "@/lib/events";
import { formatDate, formatTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gate scanner" };

export default async function ScanHomePage() {
  const user = await requireRolePage(["gate", "admin", "ceo"]);
  const isOversight = user.role === "admin" || user.role === "ceo";

  const assigned = isOversight
    ? listEventsForAdmin("approved").map((event) => ({
        id: `event_${event.id}`,
        event_id: event.id,
        event_title: event.title,
        event_starts_at: event.starts_at,
        gate_name: "Oversight",
        stats: getScanCounts(event.id),
        eventStatus: event.status as string,
      }))
    : getAssignedEventsWithStats(user.id);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow={isOversight ? "Oversight access" : "Gate operations"}
        title="Gate scanner"
        description={
          isOversight
            ? "Open any published event to validate tickets. Every scan is recorded against your account."
            : "Select an event you are assigned to and start validating entry passes."
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-600">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
            {user.name}
          </span>
        }
      />

      <div className="container-page max-w-5xl pt-6">
        {assigned.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {assigned.map((assignment) => {
              const admissionRate =
                assignment.stats.ticketsIssued > 0
                  ? Math.round(
                      (assignment.stats.admitted / assignment.stats.ticketsIssued) * 100,
                    )
                  : 0;
              return (
                <Link
                  key={assignment.id}
                  href={`/scan/${assignment.event_id}`}
                  className="group rounded-2xl border border-line bg-white p-4 transition hover:border-brand-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                        {assignment.gate_name}
                      </p>
                      <h2 className="mt-1 truncate font-display text-[16px] font-semibold tracking-[-0.02em] text-ink-950">
                        {assignment.event_title}
                      </h2>
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(assignment.event_starts_at)} ·{" "}
                        {formatTime(assignment.event_starts_at)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600" />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-surface px-2 py-1.5">
                      <p className="text-[9.5px] uppercase tracking-[0.08em] text-ink-400">Admitted</p>
                      <p className="text-[15px] font-semibold text-ink-900">
                        {assignment.stats.admitted}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface px-2 py-1.5">
                      <p className="text-[9.5px] uppercase tracking-[0.08em] text-ink-400">
                        Duplicates
                      </p>
                      <p className="text-[15px] font-semibold text-amber-600">
                        {assignment.stats.duplicate}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface px-2 py-1.5">
                      <p className="text-[9.5px] uppercase tracking-[0.08em] text-ink-400">Rate</p>
                      <p className="text-[15px] font-semibold text-ink-900">{admissionRate}%</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <StatusBadge status={assignment.eventStatus || "approved"} kind="event" />
                    <span className="text-[10px] text-ink-400">
                      {assignment.stats.ticketsIssued} passes issued
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ScanLine className="h-5 w-5" />}
            title="No events assigned"
            description="Ask an administrator to assign you to a gate. You can only scan events you are assigned to."
            actionHref="/dashboard"
            actionLabel="Back to dashboard"
          />
        )}

        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-[11px] leading-relaxed text-ink-500">
            Each QR code is signed and validated on the server. A ticket is admitted once only —
            repeat scans are rejected as duplicates and logged with the gate name and operator.
          </p>
        </div>
      </div>
    </div>
  );
}
