import type { Metadata } from "next";
import Link from "next/link";
import { FileClock, ScrollText } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import {
  listAuditLogs,
  listOrganizerApplications,
  listPriceRequests,
} from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

const groups = [
  { key: "all", label: "All activity" },
  { key: "organizer", label: "Organizers" },
  { key: "event", label: "Events" },
  { key: "price_change", label: "Pricing" },
  { key: "user", label: "Users" },
  { key: "device", label: "Devices" },
];

function groupFor(action: string) {
  if (action.startsWith("organizer.")) return "organizer";
  if (action.startsWith("event.")) return "event";
  if (action.startsWith("price_change.")) return "price_change";
  if (action.startsWith("user.")) return "user";
  if (action.startsWith("device.")) return "device";
  return "other";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  await requireRolePage(["admin", "ceo"]);
  const { group = "all" } = await searchParams;

  const logs = listAuditLogs(200);
  const visible = group === "all" ? logs : logs.filter((log) => groupFor(log.action) === group);

  const pendingOrganizers = listOrganizerApplications("all").filter(
    (application) =>
      application.status === "pending" || application.status === "requires_modification",
  ).length;
  const pendingEvents = listEventsForAdmin("pending").length;
  const pendingPrices = listPriceRequests("pending").length;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Audit log"
        description="An immutable trail of approvals, role changes, refunds, scans and operational updates."
        tabs={adminTabs({
          organizers: pendingOrganizers,
          events: pendingEvents,
          prices: pendingPrices,
        })}
      />

      <div className="container-page max-w-6xl pt-6">
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
          {groups.map((item) => (
            <Link
              key={item.key}
              href={`/admin/audit?group=${item.key}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                group === item.key
                  ? "bg-ink-950 text-white"
                  : "border border-line bg-white text-ink-500 hover:text-ink-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <p className="mt-3 text-[10.5px] text-ink-400">
          Showing {visible.length} of the latest {logs.length} recorded actions.
        </p>

        {visible.length ? (
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {visible.map((log) => (
              <div key={log.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-ink-950 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-white">
                        {log.action}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.08em] text-ink-300">
                        {log.entity_type}
                      </span>
                      {log.entity_id ? (
                        <span className="font-mono text-[9.5px] text-ink-300">
                          {log.entity_id.slice(0, 12)}…
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-ink-600">
                      <strong className="font-semibold text-ink-900">
                        {log.actor_name || "System"}
                      </strong>
                      {log.actor_role ? (
                        <span className="text-ink-400"> · {log.actor_role}</span>
                      ) : null}
                      <span className="text-ink-400"> · {formatDateTime(log.created_at)}</span>
                    </p>
                    {log.before_json || log.after_json ? (
                      <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                        {log.before_json ? (
                          <pre className="overflow-x-auto rounded-lg bg-surface px-2 py-1.5 font-mono text-[9.5px] leading-relaxed text-ink-500">
                            before {log.before_json}
                          </pre>
                        ) : null}
                        {log.after_json ? (
                          <pre className="overflow-x-auto rounded-lg bg-surface px-2 py-1.5 font-mono text-[9.5px] leading-relaxed text-ink-500">
                            after {log.after_json}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={log.outcome === "success" ? "approved" : "rejected"} />
                    <span className="hidden font-mono text-[9.5px] text-ink-300 sm:inline">
                      {log.ip || "local"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={<FileClock className="h-5 w-5" />}
              title="No activity in this group"
              description="Actions recorded by staff and administrators will appear here."
            />
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-white px-4 py-3">
          <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-[11px] leading-relaxed text-ink-500">
            Audit records are append-only. Returned payloads omit passwords and bearer secrets by
            design. The log is retained for governance reviews and dispute resolution.
          </p>
        </div>
      </div>
    </div>
  );
}
