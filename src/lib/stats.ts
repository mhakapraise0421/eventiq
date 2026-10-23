import "server-only";
import { all, get } from "./db";
import { getScanCounts } from "./gate";

export interface OverviewStats {
  grossCents: number;
  feeCents: number;
  commissionCents: number;
  refundedCents: number;
  netToOrganizerCents: number;
  ordersCount: number;
  ticketsSold: number;
  admitted: number;
}

export function getOrganizerStats(organizerId: string): OverviewStats {
  const totals = get<{
    gross: number;
    fees: number;
    commission: number;
    refunded: number;
    orders: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.subtotal_cents ELSE 0 END), 0) AS gross,
       COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.fee_cents ELSE 0 END), 0) AS fees,
       COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.commission_cents ELSE 0 END), 0) AS commission,
       COALESCE(SUM(o.refunded_cents), 0) AS refunded,
       COUNT(CASE WHEN o.status = 'paid' THEN 1 END) AS orders
     FROM orders o
     JOIN events e ON e.id = o.event_id
     WHERE e.organizer_id = ?`,
    organizerId,
  );

  const tickets = get<{ sold: number; admitted: number }>(
    `SELECT
       COUNT(CASE WHEN t.status IN ('valid','used') THEN 1 END) AS sold,
       COUNT(CASE WHEN t.status = 'used' THEN 1 END) AS admitted
     FROM tickets t JOIN events e ON e.id = t.event_id
     WHERE e.organizer_id = ?`,
    organizerId,
  );

  const gross = Number(totals?.gross || 0);
  const commission = Number(totals?.commission || 0);

  return {
    grossCents: gross,
    feeCents: Number(totals?.fees || 0),
    commissionCents: commission,
    refundedCents: Number(totals?.refunded || 0),
    netToOrganizerCents: gross - commission - Number(totals?.refunded || 0),
    ordersCount: Number(totals?.orders || 0),
    ticketsSold: Number(tickets?.sold || 0),
    admitted: Number(tickets?.admitted || 0),
  };
}

export function getOrganizerEventBreakdown(organizerId: string) {
  return all<{
    id: string;
    title: string;
    status: string;
    starts_at: string;
    gross: number;
    orders: number;
    tickets: number;
    admitted: number;
  }>(
    `SELECT e.id, e.title, e.status, e.starts_at,
       COALESCE((SELECT SUM(subtotal_cents) FROM orders WHERE event_id = e.id AND status = 'paid'), 0) AS gross,
       COALESCE((SELECT COUNT(*) FROM orders WHERE event_id = e.id AND status = 'paid'), 0) AS orders,
       COALESCE((SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND status IN ('valid','used')), 0) AS tickets,
       COALESCE((SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND status = 'used'), 0) AS admitted
     FROM events e
     WHERE e.organizer_id = ?
     ORDER BY e.starts_at DESC`,
    organizerId,
  );
}

export function getMonthlySales(organizerId: string, monthsBack = 6) {
  const start = new Date();
  start.setMonth(start.getMonth() - (monthsBack - 1));
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const rows = all<{ month: string; gross: number; orders: number }>(
    `SELECT substr(o.paid_at, 1, 7) AS month,
            SUM(o.subtotal_cents) AS gross,
            COUNT(*) AS orders
     FROM orders o JOIN events e ON e.id = o.event_id
     WHERE e.organizer_id = ? AND o.status = 'paid' AND o.paid_at >= ?
     GROUP BY month ORDER BY month ASC`,
    organizerId,
    start.toISOString(),
  );
  const series: { month: string; label: string; gross: number; orders: number }[] = [];
  for (let i = 0; i < monthsBack; i += 1) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const found = rows.find((r) => r.month === key);
    series.push({
      month: key,
      label: d.toLocaleString("en-US", { month: "short" }),
      gross: Number(found?.gross || 0),
      orders: Number(found?.orders || 0),
    });
  }
  return series;
}

export function getEventSales(eventId: string) {
  const totals = get<{
    gross: number;
    fees: number;
    commission: number;
    orders: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'paid' THEN subtotal_cents ELSE 0 END), 0) AS gross,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN fee_cents ELSE 0 END), 0) AS fees,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_cents ELSE 0 END), 0) AS commission,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) AS orders
     FROM orders WHERE event_id = ?`,
    eventId,
  );

  const tiers = all<{
    id: string;
    name: string;
    price_cents: number;
    capacity: number;
    sold: number;
    max_per_order: number;
    scanned: number;
  }>(
    `SELECT tt.id, tt.name, tt.price_cents, tt.capacity, tt.sold, tt.max_per_order,
       COALESCE((SELECT COUNT(*) FROM tickets t WHERE t.ticket_type_id = tt.id AND t.status = 'used'), 0) AS scanned
     FROM ticket_types tt WHERE tt.event_id = ? ORDER BY tt.sort_order`,
    eventId,
  );

  return {
    grossCents: Number(totals?.gross || 0),
    feeCents: Number(totals?.fees || 0),
    commissionCents: Number(totals?.commission || 0),
    ordersCount: Number(totals?.orders || 0),
    tiers,
    scans: getScanCounts(eventId),
  };
}

export interface AdminStats {
  grossCents: number;
  feeCents: number;
  commissionCents: number;
  refundedCents: number;
  ordersCount: number;
  ticketsIssued: number;
  admitted: number;
  usersCount: number;
  pendingOrganizers: number;
  pendingEvents: number;
  pendingPriceRequests: number;
  scansToday: number;
}

export function getAdminStats(): AdminStats {
  const totals = get<{
    gross: number;
    fees: number;
    commission: number;
    refunded: number;
    orders: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'paid' THEN subtotal_cents ELSE 0 END), 0) AS gross,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN fee_cents ELSE 0 END), 0) AS fees,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_cents ELSE 0 END), 0) AS commission,
       COALESCE(SUM(refunded_cents), 0) AS refunded,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) AS orders
     FROM orders`,
  );

  const tickets = get<{ issued: number; admitted: number }>(
    `SELECT COUNT(CASE WHEN status IN ('valid','used') THEN 1 END) AS issued,
            COUNT(CASE WHEN status = 'used' THEN 1 END) AS admitted
     FROM tickets`,
  );

  const counts = get<{
    users: number;
    pending_organizers: number;
    pending_events: number;
    pending_prices: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM organizer_profiles WHERE status IN ('pending','requires_modification')) AS pending_organizers,
       (SELECT COUNT(*) FROM events WHERE status = 'pending') AS pending_events,
       (SELECT COUNT(*) FROM price_requests WHERE status = 'pending') AS pending_prices`,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scans = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM scan_events WHERE created_at >= ?",
    today.toISOString(),
  );

  return {
    grossCents: Number(totals?.gross || 0),
    feeCents: Number(totals?.fees || 0),
    commissionCents: Number(totals?.commission || 0),
    refundedCents: Number(totals?.refunded || 0),
    ordersCount: Number(totals?.orders || 0),
    ticketsIssued: Number(tickets?.issued || 0),
    admitted: Number(tickets?.admitted || 0),
    usersCount: Number(counts?.users || 0),
    pendingOrganizers: Number(counts?.pending_organizers || 0),
    pendingEvents: Number(counts?.pending_events || 0),
    pendingPriceRequests: Number(counts?.pending_prices || 0),
    scansToday: Number(scans?.count || 0),
  };
}

export function getMonthlyPlatformRevenue(monthsBack = 6) {
  const start = new Date();
  start.setMonth(start.getMonth() - (monthsBack - 1));
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const rows = all<{ month: string; commission: number; gross: number }>(
    `SELECT substr(paid_at, 1, 7) AS month,
            SUM(commission_cents) AS commission,
            SUM(subtotal_cents) AS gross
     FROM orders WHERE status = 'paid' AND paid_at >= ?
     GROUP BY month ORDER BY month ASC`,
    start.toISOString(),
  );
  const series: { label: string; commission: number; gross: number }[] = [];
  for (let i = 0; i < monthsBack; i += 1) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const found = rows.find((r) => r.month === key);
    series.push({
      label: d.toLocaleString("en-US", { month: "short" }),
      commission: Number(found?.commission || 0),
      gross: Number(found?.gross || 0),
    });
  }
  return series;
}
