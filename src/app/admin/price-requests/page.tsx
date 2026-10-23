import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, ClipboardList } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { listOrganizerApplications, listPriceRequests } from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { formatDate, formatMoney } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import { StatusBadge } from "@/components/status-badge";
import { PriceDecision } from "@/components/admin-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Price change requests" };

const filters = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default async function AdminPriceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRolePage(["admin", "ceo"]);
  const { status = "pending" } = await searchParams;

  const all = listPriceRequests("all");
  const requests = listPriceRequests(status);
  const pendingOrganizers = listOrganizerApplications("all").filter(
    (application) => application.status === "pending" || application.status === "requires_modification",
  ).length;
  const pendingEvents = listEventsForAdmin("pending").length;

  const counts = {
    pending: all.filter((request) => request.status === "pending").length,
    approved: all.filter((request) => request.status === "approved").length,
    rejected: all.filter((request) => request.status === "rejected").length,
    all: all.length,
  };

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Price change requests"
        description="Review organizer price changes. Approved requests update the live ticket price and are recorded in the audit log."
        tabs={adminTabs({
          organizers: pendingOrganizers,
          events: pendingEvents,
          prices: counts.pending,
        })}
      />

      <div className="container-page max-w-4xl pt-6">
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
          {filters.map((item) => (
            <Link
              key={item.key}
              href={`/admin/price-requests?status=${item.key}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                status === item.key
                  ? "bg-ink-950 text-white"
                  : "border border-line bg-white text-ink-500 hover:text-ink-900"
              }`}
            >
              {item.label}
              <span className="ml-1.5 opacity-60">{counts[item.key as keyof typeof counts]}</span>
            </Link>
          ))}
        </div>

        {requests.length ? (
          <div className="mt-5 space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[15px] font-semibold tracking-[-0.02em]">
                      {request.event_title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {request.ticket_type_name} · requested by {request.requester_name} ·{" "}
                      {formatDate(request.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={request.status} kind="price" />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="rounded-lg bg-surface px-2.5 py-1 font-semibold text-ink-500 line-through">
                    {formatMoney(request.old_price_cents)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-300" />
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">
                    {formatMoney(request.new_price_cents)}
                  </span>
                  <span className="text-[10.5px] text-ink-400">
                    {request.new_price_cents > request.old_price_cents ? "Increase" : "Decrease"}{" "}
                    of{" "}
                    {formatMoney(Math.abs(request.new_price_cents - request.old_price_cents))}
                  </span>
                </div>

                {request.note ? (
                  <p className="mt-3 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11px] text-ink-500">
                    <ClipboardList className="mr-1 inline h-3 w-3" /> {request.note}
                  </p>
                ) : null}

                {request.reviewed_at ? (
                  <p className="mt-2 text-[10.5px] text-ink-400">
                    Reviewed {formatDate(request.reviewed_at)}
                  </p>
                ) : (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
                      <CircleDollarSign className="h-3 w-3" /> Decision
                    </p>
                    <div className="mt-2">
                      <PriceDecision requestId={request.id} />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<CircleDollarSign className="h-5 w-5" />}
              title="No price requests"
              description="Organizer price change requests will appear here for approval."
            />
          </div>
        )}
      </div>
    </div>
  );
}
