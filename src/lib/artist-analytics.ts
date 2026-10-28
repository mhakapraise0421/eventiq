import "server-only";
import { harareDayKey, todayKey } from "./calendar";
import {
  listArtistAgreements,
  listArtistInvoices,
  listArtistPayments,
} from "./agreements";
import { listArtistBookings } from "./bookings";
import type {
  ArtistAgreementWithContext,
  ArtistBookingWithEvent,
  ArtistInvoice,
  ArtistPayment,
  BookingStatus,
  PaymentStatus,
} from "./types";

const DAY_MS = 24 * 60 * 60_000;
const MAX_RANGE_DAYS = 3 * 366;

export type AnalyticsPeriod =
  | "current_month"
  | "previous_month"
  | "current_quarter"
  | "current_year"
  | "previous_year"
  | "last_12_months"
  | "custom";

export interface DateRange {
  start: string;
  end: string;
}

export interface AnalyticsTotals {
  contractedCents: number;
  receivedCents: number;
  recordedCents: number;
  outstandingCents: number;
  overpaidCents: number;
  overdueCents: number;
  upcomingCents: number;
}

export interface MonthPoint {
  key: string;
  label: string;
  contractedCents: number;
  receivedCents: number;
}

export interface MetricComparison {
  currentCents: number;
  previousCents: number;
  changePct: number | null;
  status: "up" | "down" | "flat" | "no_prior" | "no_activity";
}

export interface BookingAnalytics {
  totalRequests: number;
  requested: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  declined: number;
  withdrawn: number;
  acceptanceRatePct: number | null;
  conversionRatePct: number | null;
  performancesPerMonth: number;
  averageFeePerCompletedCents: number | null;
}

export interface StatusBreakdownRow {
  key: string;
  count: number;
  amountCents: number;
}

export interface ArtistAnalytics {
  range: DateRange;
  previousRange: DateRange;
  generatedAt: string;
  totals: AnalyticsTotals;
  previousTotals: AnalyticsTotals;
  comparisons: {
    contracted: MetricComparison;
    received: MetricComparison;
  };
  months: MonthPoint[];
  topMonths: MonthPoint[];
  bookings: BookingAnalytics;
  paymentsByStatus: StatusBreakdownRow[];
  paymentsByMethod: StatusBreakdownRow[];
  agreements: ArtistAgreementWithContext[];
  payments: ArtistPayment[];
  invoices: ArtistInvoice[];
  bookingRows: ArtistBookingWithEvent[];
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
      DAY_MS,
  );
}

function monthLastDay(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function previousRangeOf(start: string, end: string): DateRange {
  const length = daysBetween(start, end) + 1;
  return { start: addDays(start, -length), end: addDays(start, -1) };
}

export function resolveAnalyticsPeriod(
  period: string | null | undefined,
  from?: string | null,
  to?: string | null,
): { ok: true; range: DateRange; label: string } | { ok: false; error: string } {
  const today = todayKey();
  const monthKey = today.slice(0, 7);
  const year = Number(today.slice(0, 4));
  const selected = period || "current_month";

  switch (selected) {
    case "current_month":
      return {
        ok: true,
        range: { start: `${monthKey}-01`, end: monthLastDay(monthKey) },
        label: "Current month",
      };
    case "previous_month": {
      const key = shiftMonth(monthKey, -1);
      return {
        ok: true,
        range: { start: `${key}-01`, end: monthLastDay(key) },
        label: "Previous month",
      };
    }
    case "current_quarter": {
      const quarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
      const startMonth = quarter * 3 + 1;
      const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
      const endMonth = shiftMonth(`${year}-${String(startMonth).padStart(2, "0")}`, 2);
      return {
        ok: true,
        range: { start, end: monthLastDay(endMonth) },
        label: `Q${quarter + 1} ${year}`,
      };
    }
    case "current_year":
      return {
        ok: true,
        range: { start: `${year}-01-01`, end: `${year}-12-31` },
        label: `Year ${year}`,
      };
    case "previous_year":
      return {
        ok: true,
        range: { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` },
        label: `Year ${year - 1}`,
      };
    case "last_12_months":
      return {
        ok: true,
        range: { start: `${shiftMonth(monthKey, -11)}-01`, end: monthLastDay(monthKey) },
        label: "Last 12 months",
      };
    case "custom": {
      if (!isDateKey(from) || !isDateKey(to)) {
        return { ok: false, error: "Choose a valid start and end date." };
      }
      if (from > to) return { ok: false, error: "The start date must be before the end date." };
      if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
        return { ok: false, error: "Choose a range of three years or less." };
      }
      return { ok: true, range: { start: from, end: to }, label: "Custom range" };
    }
    default:
      return { ok: false, error: "Choose a supported reporting period." };
  }
}

function inRange(day: string, range: DateRange) {
  return day >= range.start && day <= range.end;
}

function monthKeysBetween(start: string, end: string) {
  const keys: string[] = [];
  let key = start.slice(0, 7);
  const last = end.slice(0, 7);
  while (key <= last) {
    keys.push(key);
    key = shiftMonth(key, 1);
  }
  return keys;
}

function activeAgreements(agreements: ArtistAgreementWithContext[]) {
  return agreements.filter(
    (agreement) =>
      agreement.accepted_fee_cents !== null &&
      agreement.booking_status !== "cancelled" &&
      agreement.event_status !== "cancelled",
  );
}

function computeTotals(
  agreements: ArtistAgreementWithContext[],
  payments: ArtistPayment[],
  invoices: ArtistInvoice[],
  range: DateRange,
  today: string,
): AnalyticsTotals {
  let contracted = 0;
  let outstanding = 0;
  let overpaid = 0;

  for (const agreement of activeAgreements(agreements)) {
    if (!inRange(harareDayKey(agreement.event_starts_at), range)) continue;
    const fee = Number(agreement.accepted_fee_cents || 0);
    const received = Number(agreement.payments_received_cents || 0);
    contracted += fee;
    if (fee >= received) outstanding += fee - received;
    else overpaid += received - fee;
  }

  let received = 0;
  let recorded = 0;
  for (const payment of payments) {
    if (!inRange(payment.paid_on, range)) continue;
    if (payment.status === "received") received += payment.amount_cents;
    if (payment.status === "recorded") recorded += payment.amount_cents;
  }

  let overdue = 0;
  let upcoming = 0;
  for (const invoice of invoices) {
    if (invoice.status === "void" || !inRange(invoice.due_on, range)) continue;
    const balance = invoice.amount_cents - Number(invoice.received_cents || 0);
    if (balance <= 0) continue;
    if (invoice.due_on < today) overdue += balance;
    else upcoming += balance;
  }

  return {
    contractedCents: contracted,
    receivedCents: received,
    recordedCents: recorded,
    outstandingCents: outstanding,
    overpaidCents: overpaid,
    overdueCents: overdue,
    upcomingCents: upcoming,
  };
}

function compare(currentCents: number, previousCents: number): MetricComparison {
  if (previousCents > 0) {
    const raw = ((currentCents - previousCents) / previousCents) * 100;
    const changePct = Math.round(raw * 10) / 10;
    return {
      currentCents,
      previousCents,
      changePct,
      status: changePct > 0 ? "up" : changePct < 0 ? "down" : "flat",
    };
  }
  return {
    currentCents,
    previousCents,
    changePct: null,
    status: currentCents > 0 ? "no_prior" : "no_activity",
  };
}

function hasEnded(booking: ArtistBookingWithEvent, nowIso: string) {
  return (booking.event_ends_at || booking.event_starts_at) < nowIso;
}

export function computeArtistAnalytics(
  artistId: string,
  range: DateRange,
): ArtistAnalytics {
  const today = todayKey();
  const nowIso = new Date().toISOString();
  const previousRange = previousRangeOf(range.start, range.end);

  const agreements = listArtistAgreements(artistId);
  const payments = listArtistPayments(artistId);
  const invoices = listArtistInvoices(artistId);
  const allBookings = listArtistBookings(artistId);

  const totals = computeTotals(agreements, payments, invoices, range, today);
  const previousTotals = computeTotals(agreements, payments, invoices, previousRange, today);

  const months = monthKeysBetween(range.start, range.end).map<MonthPoint>((key) => ({
    key,
    label: monthLabel(key),
    contractedCents: 0,
    receivedCents: 0,
  }));
  const monthIndex = new Map(months.map((point, index) => [point.key, index]));

  for (const agreement of activeAgreements(agreements)) {
    const day = harareDayKey(agreement.event_starts_at);
    if (!inRange(day, range)) continue;
    const index = monthIndex.get(day.slice(0, 7));
    if (index === undefined) continue;
    months[index].contractedCents += Number(agreement.accepted_fee_cents || 0);
  }

  for (const payment of payments) {
    if (payment.status !== "received" || !inRange(payment.paid_on, range)) continue;
    const index = monthIndex.get(payment.paid_on.slice(0, 7));
    if (index === undefined) continue;
    months[index].receivedCents += payment.amount_cents;
  }

  const topMonths = months
    .filter((point) => point.contractedCents > 0)
    .sort((a, b) => b.contractedCents - a.contractedCents)
    .slice(0, 3);

  const bookingRows = allBookings.filter((booking) =>
    inRange(harareDayKey(booking.event_starts_at), range),
  );
  const statusCount = (status: BookingStatus) =>
    bookingRows.filter((booking) => booking.status === status).length;
  const confirmed = statusCount("accepted");
  const completed = bookingRows.filter(
    (booking) => booking.status === "accepted" && hasEnded(booking, nowIso),
  ).length;
  const cancelled = statusCount("cancelled");
  const declined = statusCount("declined");
  const acceptedEver = confirmed + cancelled;
  const decided = acceptedEver + declined;

  const completedFees = activeAgreements(agreements).filter((agreement) => {
    const day = harareDayKey(agreement.event_starts_at);
    return (
      inRange(day, range) &&
      agreement.booking_status === "accepted" &&
      (agreement.event_ends_at || agreement.event_starts_at) < nowIso
    );
  });
  const averageFeePerCompletedCents =
    completedFees.length > 0
      ? Math.round(
          completedFees.reduce((sum, agreement) => sum + Number(agreement.accepted_fee_cents), 0) /
            completedFees.length,
        )
      : null;

  const periodMonths = Math.max(1, months.length);

  const paymentRows = payments.filter((payment) => inRange(payment.paid_on, range));
  const byStatus = new Map<string, StatusBreakdownRow>();
  for (const payment of paymentRows) {
    const row = byStatus.get(payment.status) || {
      key: payment.status,
      count: 0,
      amountCents: 0,
    };
    row.count += 1;
    row.amountCents += payment.amount_cents;
    byStatus.set(payment.status, row);
  }
  const statusOrder: PaymentStatus[] = ["received", "recorded", "failed"];
  const paymentsByStatus = statusOrder
    .map((status) => byStatus.get(status))
    .filter((row): row is StatusBreakdownRow => Boolean(row));

  const byMethod = new Map<string, StatusBreakdownRow>();
  for (const payment of paymentRows) {
    if (payment.status !== "received") continue;
    const row = byMethod.get(payment.method) || { key: payment.method, count: 0, amountCents: 0 };
    row.count += 1;
    row.amountCents += payment.amount_cents;
    byMethod.set(payment.method, row);
  }
  const paymentsByMethod = Array.from(byMethod.values()).sort(
    (a, b) => b.amountCents - a.amountCents,
  );

  return {
    range,
    previousRange,
    generatedAt: nowIso,
    totals,
    previousTotals,
    comparisons: {
      contracted: compare(totals.contractedCents, previousTotals.contractedCents),
      received: compare(totals.receivedCents, previousTotals.receivedCents),
    },
    months,
    topMonths,
    bookings: {
      totalRequests: bookingRows.length,
      requested: statusCount("requested"),
      confirmed,
      completed,
      cancelled,
      declined,
      withdrawn: statusCount("withdrawn"),
      acceptanceRatePct: decided > 0 ? Math.round((acceptedEver / decided) * 100) : null,
      conversionRatePct:
        bookingRows.length > 0 ? Math.round((completed / bookingRows.length) * 100) : null,
      performancesPerMonth: Math.round((completed / periodMonths) * 10) / 10,
      averageFeePerCompletedCents,
    },
    paymentsByStatus,
    paymentsByMethod,
    agreements,
    payments,
    invoices,
    bookingRows,
  };
}
