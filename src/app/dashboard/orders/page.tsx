import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listOrdersForUser, releaseExpiredOrders } from "@/lib/orders";
import { formatDate, formatMoneyExact, formatTime, ORDER_STATUS_LABEL } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My orders" };

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tickets", label: "My tickets" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/saved", label: "Saved" },
  { href: "/dashboard/parking", label: "Parking" },
  { href: "/dashboard/profile", label: "Profile" },
];

const filters = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Awaiting payment" },
  { key: "refunded", label: "Refunded" },
  { key: "failed", label: "Unsuccessful" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status = "all" } = await searchParams;
  releaseExpiredOrders();

  const orders = listOrdersForUser(user.id);
  const visible =
    status === "all"
      ? orders
      : status === "failed"
        ? orders.filter((order) => ["failed", "expired"].includes(order.status))
        : orders.filter((order) => order.status === status);

  const totalPaid = orders
    .filter((order) => order.status === "paid" || order.status === "partially_refunded")
    .reduce((sum, order) => sum + order.total_cents, 0);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Attendee account"
        title="Orders & receipts"
        description="A complete record of your ticket purchases, payment status and receipts."
        tabs={tabs}
        actions={
          <div className="rounded-xl border border-line bg-white px-4 py-2 text-right">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-ink-400">
              Total paid
            </p>
            <p className="font-display text-[16px] font-semibold">{formatMoneyExact(totalPaid)}</p>
          </div>
        }
      />

      <div className="container-page pt-6">
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
          {filters.map((item) => (
            <Link
              key={item.key}
              href={`/dashboard/orders?status=${item.key}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                status === item.key || (!filters.slice(1).some((f) => f.key === status) && item.key === "all")
                  ? "bg-ink-950 text-white"
                  : "border border-line bg-white text-ink-500 hover:text-ink-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {visible.length ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="hide-scrollbar overflow-x-auto">
              <table className="table-base min-w-[720px]">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Reference</th>
                    <th>Ordered</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr key={order.id} className="hover:bg-surface/40">
                      <td>
                        <p className="font-semibold text-ink-950">{order.event_title}</p>
                        <p className="mt-0.5 text-[10.5px] text-ink-400">
                          {formatDate(order.event_starts_at)} · {formatTime(order.event_starts_at)}
                        </p>
                      </td>
                      <td className="font-mono text-[11px] text-ink-600">{order.reference}</td>
                      <td className="text-[11.5px] text-ink-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="font-semibold">{formatMoneyExact(order.total_cents)}</td>
                      <td>
                        <StatusBadge status={order.status} kind="order" />
                      </td>
                      <td className="text-right">
                        <Link
                          href={
                            order.status === "pending"
                              ? `/checkout/${order.id}`
                              : `/orders/${order.id}`
                          }
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700"
                        >
                          {order.status === "pending" ? "Resume" : "View"}
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No orders in this view"
              description={
                status === "all"
                  ? "Your ticket orders and receipts will appear here after your first purchase."
                  : `There are no ${ORDER_STATUS_LABEL[status]?.toLowerCase() || status} orders on this account.`
              }
              actionHref="/events"
              actionLabel="Browse events"
            />
          </div>
        )}

        <p className="mt-4 text-[10.5px] leading-relaxed text-ink-400">
          Service fees are shown separately on each receipt. Refund eligibility depends on the
          event terms and our refund policy.
        </p>
      </div>
    </div>
  );
}
