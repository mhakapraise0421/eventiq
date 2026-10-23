import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Eye, MapPin, ShieldCheck } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { listOrganizerApplications, listPriceRequests } from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import { StatusBadge } from "@/components/status-badge";
import { EventDecision } from "@/components/admin-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Event approvals" };

const filters = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRolePage(["admin", "ceo"]);
  const { status = "pending" } = await searchParams;

  const all = listEventsForAdmin();
  const events = listEventsForAdmin(status === "all" ? undefined : status);
  const pendingOrganizers = listOrganizerApplications("all").filter(
    (application) => application.status === "pending" || application.status === "requires_modification",
  ).length;
  const pendingPrices = listPriceRequests("pending").length;

  const counts = {
    pending: all.filter((event) => event.status === "pending").length,
    approved: all.filter((event) => event.status === "approved").length,
    draft: all.filter((event) => event.status === "draft").length,
    rejected: all.filter((event) => event.status === "rejected").length,
    cancelled: all.filter((event) => event.status === "cancelled").length,
    completed: all.filter((event) => event.status === "completed").length,
    all: all.length,
  };

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Event approvals"
        description="Review event submissions, publish approved events and take down unsafe listings."
        tabs={adminTabs({
          organizers: pendingOrganizers,
          events: counts.pending,
          prices: pendingPrices,
        })}
      />

      <div className="container-page max-w-5xl pt-6">
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
          {filters.map((item) => (
            <Link
              key={item.key}
              href={`/admin/events?status=${item.key}`}
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

        {events.length ? (
          <div className="mt-5 space-y-3">
            {events.map((event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-2xl border border-line bg-white"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative h-32 w-full shrink-0 sm:h-auto sm:w-[150px]">
                    {event.cover_image ? (
                      <Image
                        src={event.cover_image}
                        alt={event.title}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 150px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-brand-100 to-aqua-300/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-[15.5px] font-semibold tracking-[-0.02em]">
                          {event.title}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-ink-400">
                          {event.organizer_business || event.organizer_name} · {event.category}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-500">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> {formatDate(event.starts_at)} ·{" "}
                            {formatTime(event.starts_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {event.venue}, {event.city}
                          </span>
                        </p>
                      </div>
                      <StatusBadge status={event.status} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-ink-500">
                      <span>
                        {event.tier_count || 0} tiers · {event.total_capacity || 0} capacity
                      </span>
                      <span>
                        {event.min_price_cents === 0
                          ? "Free"
                          : `${formatMoney(event.min_price_cents || 0)} – ${formatMoney(
                              event.max_price_cents || 0,
                            )}`}
                      </span>
                      <span>Submitted {event.submitted_at ? formatDate(event.submitted_at) : "—"}</span>
                    </div>

                    {event.rejection_reason ? (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[10.5px] text-rose-700">
                        {event.rejection_reason}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link href={`/events/${event.slug}`} className="btn btn-ghost btn-sm">
                        <Eye className="h-3.5 w-3.5" /> Preview listing
                      </Link>
                      <span className="text-[10px] text-ink-400">
                        ID {event.id.slice(0, 12)}…
                      </span>
                    </div>

                    {["pending", "approved"].includes(event.status) ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
                          <ShieldCheck className="h-3 w-3" /> Approval action
                        </p>
                        <EventDecision eventId={event.id} status={event.status} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="No events in this view"
              description="Events matching this status will appear here for review."
            />
          </div>
        )}
      </div>
    </div>
  );
}
