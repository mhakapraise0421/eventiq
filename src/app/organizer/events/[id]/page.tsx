import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Eye,
  Pencil,
  ScanLine,
  Ticket,
  Users,
} from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import { getEventById, getTicketTypes } from "@/lib/events";
import { getEventSales } from "@/lib/stats";
import { getRecentScans } from "@/lib/gate";
import { listEventOrders, listOrganizerPriceRequests } from "@/lib/organizer";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyExact,
  formatTime,
  percent,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { StatCard, MoneyStat } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/charts";
import { SubmitEventButton } from "@/components/submit-event-button";
import { PriceRequestPanel } from "@/components/price-request-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage event" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/agreements", label: "Agreements" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireApprovedOrganizer();
  const { id } = await params;
  const event = getEventById(id);
  if (!event || event.organizer_id !== user.id) notFound();

  const tiers = getTicketTypes(event.id);
  const sales = getEventSales(event.id);
  const orders = listEventOrders(event.id, 12);
  const scans = getRecentScans(event.id, 8);
  const priceRequests = listOrganizerPriceRequests(user.id).filter(
    (request) => request.event_id === event.id,
  );
  const pendingTierIds = priceRequests
    .filter((request) => request.status === "pending")
    .map((request) => request.ticket_type_id);

  const editable = ["draft", "rejected"].includes(event.status);
  const canRequestPrice = ["pending", "approved"].includes(event.status);
  const totalSold = tiers.reduce((sum, tier) => sum + tier.sold, 0);
  const totalCapacity = tiers.reduce((sum, tier) => sum + tier.capacity, 0);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Organizer console · Event"
        title={event.title}
        description={`${formatDate(event.starts_at)} · ${formatTime(event.starts_at)} · ${event.venue}, ${event.city}`}
        tabs={tabs}
        actions={
          <>
            <Link href={`/events/${event.slug}`} className="btn btn-outline btn-sm">
              <Eye className="h-3.5 w-3.5" /> Preview
            </Link>
            {editable ? (
              <Link href={`/organizer/events/${event.id}/edit`} className="btn btn-outline btn-sm">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Link>
            ) : null}
            {editable ? <SubmitEventButton eventId={event.id} /> : null}
          </>
        }
      />

      <div className="container-page max-w-5xl pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          <span className="badge bg-surface text-ink-500">{event.category}</span>
          <span className="badge bg-surface text-ink-500">
            {event.age_limit || "All ages"}
          </span>
          {event.approved_at ? (
            <span className="text-[10.5px] text-ink-400">
              Approved {formatDate(event.approved_at)}
            </span>
          ) : null}
        </div>

        {event.rejection_reason ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11.5px] leading-relaxed text-rose-700">
            <strong>Review feedback:</strong> {event.rejection_reason}
          </div>
        ) : null}

        {event.status === "pending" ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-800">
            This event is awaiting EventIQ approval. It is not visible to the public yet.
            Price change requests can be submitted while it is in review.
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyStat
            label="Gross sales"
            cents={sales.grossCents}
            hint={`${sales.ordersCount} paid orders`}
            icon={<CircleDollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Tickets sold"
            value={`${totalSold} / ${totalCapacity}`}
            hint={`${percent(totalSold, totalCapacity || 1)}% of capacity`}
            icon={<Ticket className="h-4 w-4" />}
          />
          <StatCard
            label="Admitted"
            value={sales.scans.admitted}
            hint={`${sales.scans.ticketsIssued} tickets issued`}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Duplicate scans"
            value={sales.scans.duplicate}
            hint="Blocked at the gate"
            icon={<ScanLine className="h-4 w-4" />}
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
              Ticket inventory
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table-base min-w-[560px]">
                  <thead>
                    <tr>
                      <th>Ticket type</th>
                      <th>Price</th>
                      <th>Sold</th>
                      <th>Available</th>
                      <th>Scanned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => (
                      <tr key={tier.id}>
                        <td>
                          <p className="font-semibold text-ink-950">{tier.name}</p>
                          {tier.perks ? (
                            <p className="mt-0.5 text-[10px] text-ink-400">{tier.perks}</p>
                          ) : null}
                        </td>
                        <td className="font-semibold">{formatMoney(tier.price_cents)}</td>
                        <td>
                          <p>
                            {tier.sold} / {tier.capacity}
                          </p>
                          <div className="mt-1 w-20">
                            <ProgressBar value={tier.sold} max={tier.capacity || 1} />
                          </div>
                        </td>
                        <td>{Math.max(0, tier.capacity - tier.sold)}</td>
                        <td>
                          {sales.tiers.find((row) => row.id === tier.id)?.scanned || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-[11.5px] sm:grid-cols-3">
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-ink-400">Subtotal</p>
                <p className="font-semibold">{formatMoneyExact(sales.grossCents)}</p>
              </div>
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-ink-400">Service fees</p>
                <p className="font-semibold">{formatMoneyExact(sales.feeCents)}</p>
              </div>
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-ink-400">Commission (8%)</p>
                <p className="font-semibold">{formatMoneyExact(sales.commissionCents)}</p>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            {canRequestPrice ? (
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-[12.5px] font-semibold text-ink-950">Request a price change</p>
                <p className="mt-1 text-[10.5px] text-ink-400">
                  Changes apply only after approval by the EventIQ team.
                </p>
                <div className="mt-3">
                  <PriceRequestPanel
                    eventId={event.id}
                    tiers={tiers.map((tier) => ({
                      id: tier.id,
                      name: tier.name,
                      price_cents: tier.price_cents,
                    }))}
                    pendingTierIds={pendingTierIds}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-surface/70 p-4">
                <p className="text-[11.5px] font-semibold text-ink-900">
                  Price changes unlock after submission
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
                  You can edit prices freely while this event is a draft. Once submitted,
                  changes go through the approval workflow.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                Entry progress
              </p>
              <div className="mt-3 space-y-2 text-[11.5px]">
                <div className="flex justify-between">
                  <span className="text-ink-400">Tickets issued</span>
                  <span className="font-semibold">{sales.scans.ticketsIssued}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Admitted</span>
                  <span className="font-semibold">{sales.scans.admitted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Duplicate attempts</span>
                  <span className="font-semibold">{sales.scans.duplicate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Other rejected</span>
                  <span className="font-semibold">{sales.scans.rejected}</span>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar
                  value={sales.scans.admitted}
                  max={sales.scans.ticketsIssued || 1}
                  tone="emerald"
                />
              </div>
            </div>
          </aside>
        </div>

        {priceRequests.length ? (
          <section className="mt-6">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
              Price change requests
            </h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Ticket type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Requested</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="font-semibold text-ink-950">{request.ticket_type_name}</td>
                      <td>{formatMoney(request.old_price_cents)}</td>
                      <td className="font-semibold">{formatMoney(request.new_price_cents)}</td>
                      <td className="text-[11px] text-ink-400">
                        {formatDateTime(request.created_at)}
                      </td>
                      <td>
                        <StatusBadge status={request.status} kind="price" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
              Recent orders
            </h2>
            {orders.length ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Attendee</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="font-mono text-[10.5px]">{order.reference}</td>
                        <td>
                          <p className="text-[11.5px] font-medium">{order.user_name}</p>
                          <p className="text-[10px] text-ink-400">{order.user_email}</p>
                        </td>
                        <td>{formatMoney(order.total_cents)}</td>
                        <td>
                          <StatusBadge status={order.status} kind="order" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-line bg-white px-4 py-6 text-center text-[11.5px] text-ink-400">
                No orders yet for this event.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
              Recent gate activity
            </h2>
            {scans.length ? (
              <div className="mt-3 space-y-2">
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-semibold text-ink-900">
                        {scan.holder_name || scan.ticket_code}
                      </p>
                      <p className="text-[10px] text-ink-400">
                        {scan.gate || "Gate"} · {formatDateTime(scan.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={scan.result} label={scan.result} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-line bg-white px-4 py-6 text-center text-[11.5px] text-ink-400">
                No scans yet. Gate activity appears here during the event.
              </p>
            )}
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-4 text-[11.5px]">
          <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
          <span className="text-ink-500">
            {formatDate(event.starts_at)} · {formatTime(event.starts_at)} –{" "}
            {event.ends_at ? formatTime(event.ends_at) : "—"}
          </span>
          <Link href="/organizer/reports" className="ml-auto font-semibold text-brand-700">
            Download event report
          </Link>
        </div>
      </div>
    </div>
  );
}
