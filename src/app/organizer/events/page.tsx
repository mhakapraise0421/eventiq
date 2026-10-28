import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Eye, MapPin, Plus, Settings2 } from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import { listOrganizerEvents } from "@/lib/events";
import { formatDate, formatMoney, formatTime, percent } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My events" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

const filters = [
  { key: "all", label: "All events" },
  { key: "draft", label: "Drafts" },
  { key: "pending", label: "In review" },
  { key: "approved", label: "Published" },
  { key: "rejected", label: "Rejected" },
  { key: "completed", label: "Completed" },
];

export default async function OrganizerEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user } = await requireApprovedOrganizer();
  const { status = "all" } = await searchParams;

  const events = listOrganizerEvents(user.id);
  const visible = status === "all" ? events : events.filter((event) => event.status === status);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Organizer console"
        title="Events"
        description="Create events, submit them for approval and manage ticket inventory."
        tabs={tabs}
        actions={
          <Link href="/organizer/events/new" className="btn btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> Create event
          </Link>
        }
      />

      <div className="container-page max-w-5xl pt-6">
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
          {filters.map((item) => {
            const count =
              item.key === "all"
                ? events.length
                : events.filter((event) => event.status === item.key).length;
            return (
              <Link
                key={item.key}
                href={`/organizer/events?status=${item.key}`}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  status === item.key
                    ? "bg-ink-950 text-white"
                    : "border border-line bg-white text-ink-500 hover:text-ink-900"
                }`}
              >
                {item.label}
                <span className="ml-1.5 opacity-60">{count}</span>
              </Link>
            );
          })}
        </div>

        {visible.length ? (
          <div className="mt-5 space-y-3">
            {visible.map((event) => {
              const sold = event.tickets_sold || 0;
              const capacity = event.total_capacity || 0;
              const editable = ["draft", "rejected"].includes(event.status);
              return (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-2xl border border-line bg-white"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="relative h-36 w-full shrink-0 sm:h-auto sm:w-[168px]">
                      {event.cover_image ? (
                        <Image
                          src={event.cover_image}
                          alt={event.title}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, 168px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-brand-100 to-aqua-300/30" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
                            </span>
                            <span className="text-ink-300">·</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {event.venue}, {event.city}
                            </span>
                          </p>
                          <p className="mt-1 truncate font-display text-[16px] font-semibold tracking-[-0.02em]">
                            {event.title}
                          </p>
                          {event.rejection_reason ? (
                            <p className="mt-1 text-[10.5px] text-rose-600">
                              {event.rejection_reason}
                            </p>
                          ) : null}
                        </div>
                        <StatusBadge status={event.status} />
                      </div>

                      <div className="grid gap-3 text-[11px] sm:grid-cols-3">
                        <div>
                          <p className="text-ink-400">Tickets sold</p>
                          <p className="mt-0.5 font-semibold text-ink-950">
                            {sold} / {capacity}
                          </p>
                          <div className="mt-1 max-w-[130px]">
                            <ProgressBar value={sold} max={capacity || 1} />
                          </div>
                        </div>
                        <div>
                          <p className="text-ink-400">Tiers</p>
                          <p className="mt-0.5 font-semibold text-ink-950">
                            {event.tier_count || 0} ticket types
                          </p>
                          <p className="mt-1 text-ink-400">
                            {event.min_price_cents === 0
                              ? "Free entry"
                              : `From ${formatMoney(event.min_price_cents || 0)}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-ink-400">Capacity used</p>
                          <p className="mt-0.5 font-semibold text-ink-950">
                            {percent(sold, capacity)}%
                          </p>
                          <p className="mt-1 text-ink-400">
                            {Math.max(0, capacity - sold)} remaining
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <Link
                          href={`/organizer/events/${event.id}`}
                          className="btn btn-outline btn-sm"
                        >
                          <Settings2 className="h-3.5 w-3.5" /> Manage
                        </Link>
                        {editable ? (
                          <Link
                            href={`/organizer/events/${event.id}/edit`}
                            className="btn btn-ghost btn-sm"
                          >
                            Edit draft
                          </Link>
                        ) : null}
                        <Link
                          href={`/events/${event.slug}`}
                          className="btn btn-ghost btn-sm"
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Link>
                        <span className="ml-auto text-[10px] text-ink-400">
                          Submitted {event.submitted_at ? formatDate(event.submitted_at) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title={status === "all" ? "No events yet" : "No events in this view"}
              description={
                status === "all"
                  ? "Create your first event, add ticket types and submit it for approval."
                  : "Try a different status filter to see other events."
              }
              actionHref="/organizer/events/new"
              actionLabel="Create event"
            />
          </div>
        )}
      </div>
    </div>
  );
}
