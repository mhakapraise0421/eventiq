import type { Metadata } from "next";
import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { listOrganizerApplications, listPriceRequests } from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { listRecentOrdersForAdmin } from "@/lib/orders";
import { formatDateTime, formatMoneyExact } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import { StatusBadge } from "@/components/status-badge";
import { RefundButton } from "@/components/admin-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders & refunds" };

const filters = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "refunded", label: "Refunded" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRolePage(["admin", "ceo"]);
  const { status = "all" } = await searchParams;

  const orders = listRecentOrdersForAdmin();
  const visible = status === "all" ? orders : orders.filter((order) => order.status === status);
  const pendingOrganizers = listOrganizerApplications("all").filter(
    (application) => application.status === "pending" || application.status === "requires_modification",
  ).length;
  const pendingEvents = listEventsForAdmin("pending").length;
  const pendingPrices = listPriceRequests("pending").length;
  const paidValue = orders
    .filter((order) => order.status === "paid")
    .reduce((sum, order) => sum + order.total_cents, 0);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Orders & refunds"
        description="Inspect recent orders, confirm payment state and issue refunds where policy allows."
        tabs={adminTabs({
          organizers: pendingOrganizers,
          events: pendingEvents,
          prices: pendingPrices,
        })}
        actions={
          <a href="/api/reports/sales" className="btn btn-outline btn-sm">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        }
      />

      <div className="container-page max-w-6xl pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
            {filters.map((item) => (
              <Link
                key={item.key}
                href={`/admin/orders?status=${item.key}`}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  status === item.key
                    ? "bg-ink-950 text-white"
                    : "border border-line bg-white text-ink-500 hover:text-ink-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-ink-400">
            Paid value in this list: <strong className="text-ink-800">{formatMoneyExact(paidValue)}</strong>
          </p>
        </div>

        {visible.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="hide-scrollbar overflow-x-auto">
              <table className="table-base min-w-[860px]">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Event</th>
                    <th>Attendee</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Paid</th>
                    <th className="text-right">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr key={order.id} className="hover:bg-surface/40">
                      <td className="font-mono text-[10.5px]">{order.reference}</td>
                      <td className="max-w-[180px]">
                        <p className="truncate text-[11.5px] font-semibold text-ink-950">
                          {order.event_title}
                        </p>
                        <p className="text-[10px] text-ink-400">{order.event_id.slice(0, 10)}…</p>
                      </td>
                      <td>
                        <p className="text-[11.5px]">{order.user_name}</p>
                        <p className="text-[10px] text-ink-400">{order.user_email}</p>
                      </td>
                      <td className="font-semibold">{formatMoneyExact(order.total_cents)}</td>
                      <td>
                        <StatusBadge status={order.status} kind="order" />
                      </td>
                      <td className="text-[10.5px] text-ink-500">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="text-[10.5px] text-ink-500">
                        {order.paid_at ? formatDateTime(order.paid_at) : "—"}
                      </td>
                      <td className="text-right">
                        {order.status === "paid" ? (
                          <RefundButton orderId={order.id} reference={order.reference} />
                        ) : (
                          <span className="text-[10px] text-ink-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No orders in this view"
              description="Orders matching this status will appear here."
            />
          </div>
        )}

        <p className="mt-4 text-[10.5px] leading-relaxed text-ink-400">
          Refunds are only allowed for paid orders with no scanned tickets. Refunding voids all
          unused tickets and releases inventory. Every refund is recorded in the audit log.
        </p>
      </div>
    </div>
  );
}
