import "server-only";
import { all, get, transaction } from "./db";
import { writeAudit } from "./audit";
import { randomId } from "./format";
import { hashBytes, readPrivateFile, savePrivateFile, deletePrivateFile } from "./storage";
import { harareDayKey } from "./calendar";
import { buildArtistReportPdf } from "./artist-report-pdf";
import {
  computeArtistAnalytics,
  daysBetween,
  isDateKey,
  type DateRange,
} from "./artist-analytics";
import { listArtistBookings } from "./bookings";
import type {
  ArtistReport,
  ArtistReportType,
  ReportBookingFilter,
  ReportPaymentFilter,
  User,
} from "./types";

const MAX_RANGE_DAYS = 3 * 366;

export const REPORT_TYPES: ArtistReportType[] = [
  "monthly_earnings",
  "annual_earnings",
  "quarterly_earnings",
  "payment_history",
  "outstanding_payments",
  "booking_performance",
  "custom_financial",
  "artist_activity",
];

export const REPORT_PAYMENT_FILTERS: ReportPaymentFilter[] = [
  "all",
  "received",
  "recorded",
  "failed",
];

export const REPORT_BOOKING_FILTERS: ReportBookingFilter[] = [
  "all",
  "requested",
  "accepted",
  "declined",
  "withdrawn",
  "cancelled",
];

export interface ReportRequest {
  reportType?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  paymentStatus?: unknown;
  bookingStatus?: unknown;
}

type ValidatedReport =
  | {
      ok: true;
      reportType: ArtistReportType;
      range: DateRange;
      paymentFilter: ReportPaymentFilter;
      bookingFilter: ReportBookingFilter;
    }
  | { ok: false; error: string };

function lastDayOfMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function reportErrorMessage(type: ArtistReportType) {
  if (type === "monthly_earnings") return "Choose a whole calendar month for this report.";
  if (type === "quarterly_earnings") return "Choose a whole calendar quarter for this report.";
  if (type === "annual_earnings") return "Choose a whole calendar year for this report.";
  return "Choose a valid reporting period.";
}

export function validateReportRequest(input: ReportRequest): ValidatedReport {
  const reportType = String(input.reportType || "") as ArtistReportType;
  if (!REPORT_TYPES.includes(reportType)) {
    return { ok: false, error: "Choose a supported report type." };
  }

  const start = typeof input.periodStart === "string" ? input.periodStart.trim() : "";
  const end = typeof input.periodEnd === "string" ? input.periodEnd.trim() : "";
  if (!isDateKey(start) || !isDateKey(end)) {
    return { ok: false, error: "Choose a valid start and end date." };
  }
  if (start > end) {
    return { ok: false, error: "The start date must be before the end date." };
  }

  if (reportType === "monthly_earnings") {
    const month = start.slice(0, 7);
    if (start !== `${month}-01` || end !== lastDayOfMonth(month)) {
      return { ok: false, error: reportErrorMessage(reportType) };
    }
  } else if (reportType === "quarterly_earnings") {
    const month = Number(start.slice(5, 7));
    const quarterMonth = start.slice(0, 7);
    if (
      start.slice(8, 10) !== "01" ||
      month % 3 !== 1 ||
      end !== lastDayOfMonth(shiftMonth(quarterMonth, 2))
    ) {
      return { ok: false, error: reportErrorMessage(reportType) };
    }
  } else if (reportType === "annual_earnings") {
    const year = start.slice(0, 4);
    if (start !== `${year}-01-01` || end !== `${year}-12-31`) {
      return { ok: false, error: reportErrorMessage(reportType) };
    }
  } else if (daysBetween(start, end) + 1 > MAX_RANGE_DAYS) {
    return { ok: false, error: "Choose a range of three years or less." };
  }

  const rawPayment = input.paymentStatus ?? "all";
  if (!REPORT_PAYMENT_FILTERS.includes(rawPayment as ReportPaymentFilter)) {
    return { ok: false, error: "Choose a supported payment filter." };
  }
  const rawBooking = input.bookingStatus ?? "all";
  if (!REPORT_BOOKING_FILTERS.includes(rawBooking as ReportBookingFilter)) {
    return { ok: false, error: "Choose a supported booking filter." };
  }
  const paymentFilter = rawPayment as ReportPaymentFilter;
  const bookingFilter = rawBooking as ReportBookingFilter;

  return {
    ok: true,
    reportType,
    range: { start, end },
    paymentFilter,
    bookingFilter,
  };
}

function inRange(day: string, range: DateRange) {
  return day >= range.start && day <= range.end;
}

export function listArtistReports(artistId: string) {
  return all<ArtistReport>(
    "SELECT * FROM artist_reports WHERE artist_id = ? ORDER BY created_at DESC",
    artistId,
  );
}

export function getArtistReport(id: string, artistId: string) {
  return get<ArtistReport>(
    "SELECT * FROM artist_reports WHERE id = ? AND artist_id = ?",
    id,
    artistId,
  );
}

export async function createArtistReport(
  input: ReportRequest,
  artist: User,
  artistName: string,
  ip?: string | null,
): Promise<
  | { ok: true; reportId: string; report: ArtistReport }
  | { ok: false; error: string }
> {
  const validated = validateReportRequest(input);
  if (!validated.ok) return validated;

  const { reportType, range, paymentFilter, bookingFilter } = validated;
  const analytics = computeArtistAnalytics(artist.id, range);

  const paymentRows = analytics.payments.filter(
    (payment) =>
      inRange(payment.paid_on, range) &&
      (paymentFilter === "all" || payment.status === paymentFilter),
  );
  const outstandingRows = analytics.invoices.filter((invoice) => {
    if (invoice.status === "void" || !inRange(invoice.due_on, range)) return false;
    return invoice.amount_cents - Number(invoice.received_cents || 0) > 0;
  });
  const bookingRows = analytics.bookingRows.filter(
    (booking) => bookingFilter === "all" || booking.status === bookingFilter,
  );

  const bookings = listArtistBookings(artist.id);
  const requestsReceived = bookings.filter((booking) =>
    inRange(harareDayKey(booking.created_at), range),
  ).length;
  const confirmedInPeriod = bookings.filter(
    (booking) =>
      booking.status === "accepted" &&
      booking.responded_at !== null &&
      inRange(harareDayKey(booking.responded_at), range),
  ).length;
  const invoicesIssued = analytics.invoices.filter((invoice) =>
    inRange(invoice.issued_on, range),
  ).length;
  const reportCount = get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM artist_reports
     WHERE artist_id = ? AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?`,
    artist.id,
    range.start,
    range.end,
  );
  const activityRows = [
    {
      label: "Booking requests received",
      value: requestsReceived,
      note: "Bookings created within the period, whatever their event date.",
    },
    {
      label: "Bookings confirmed",
      value: confirmedInPeriod,
      note: "Bookings accepted in the period.",
    },
    {
      label: "Performances completed",
      value: analytics.bookings.completed,
      note: "Confirmed events in the period whose end time has passed.",
    },
    {
      label: "Payments received",
      value: analytics.paymentsByStatus.find((row) => row.key === "received")?.count || 0,
      note: "Payments the artist confirmed as received in the period.",
    },
    {
      label: "Invoices issued",
      value: invoicesIssued,
      note: "Artist invoices created in the period.",
    },
    {
      label: "Reports generated",
      value: Number(reportCount?.count || 0) + 1,
      note: "Reports generated for this artist in the period, including this one.",
    },
  ];

  const snapshot = {
    version: 1,
    reportType,
    range,
    paymentFilter,
    bookingFilter,
    currency: "USD",
    totals: analytics.totals,
    bookings: analytics.bookings,
    months: analytics.months,
    topMonths: analytics.topMonths,
    payments: paymentRows.map((payment) => ({
      id: payment.id,
      paidOn: payment.paid_on,
      amountCents: payment.amount_cents,
      status: payment.status,
      method: payment.method,
      reference: payment.reference,
      eventTitle: payment.event_title || null,
    })),
    outstanding: outstandingRows.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      dueOn: invoice.due_on,
      amountCents: invoice.amount_cents,
      receivedCents: invoice.received_cents,
      eventTitle: invoice.event_title || null,
    })),
    bookingRows: bookingRows.map((booking) => ({
      id: booking.id,
      eventTitle: booking.event_title,
      eventDay: harareDayKey(booking.event_starts_at),
      status: booking.status,
    })),
    activity: activityRows,
  };
  const dataHash = hashBytes(Buffer.from(JSON.stringify(snapshot), "utf8"));

  const id = randomId("rpt_");
  const createdAt = new Date().toISOString();
  const storageKey = `artist-reports/${artist.id}/${id}.pdf`;
  const pdf = await buildArtistReportPdf({
    reportId: id,
    reportType,
    artistName,
    range,
    generatedAt: createdAt,
    currency: "USD",
    analytics,
    paymentFilter,
    bookingFilter,
    paymentRows,
    outstandingRows,
    bookingRows,
    activityRows,
    dataHash,
  });
  const pdfHash = hashBytes(pdf);

  try {
    await savePrivateFile(storageKey, pdf);
  } catch (error) {
    console.error("Report PDF could not be stored", error);
    return { ok: false, error: "Could not store the generated report. Try again." };
  }

  let report: ArtistReport;
  try {
    report = transaction((db) => {
      const previous = db
        .prepare(
          `SELECT id FROM artist_reports
           WHERE artist_id = ? AND report_type = ? AND period_start = ? AND period_end = ?
             AND COALESCE(payment_status, 'all') = ?
             AND COALESCE(booking_status, 'all') = ?
             AND superseded_by_id IS NULL
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(artist.id, reportType, range.start, range.end, paymentFilter, bookingFilter) as
        | { id: string }
        | undefined;

      db.prepare(
        `INSERT INTO artist_reports
           (id, artist_id, report_type, period_start, period_end, payment_status, booking_status,
            currency, status, storage_key, pdf_sha256, data_sha256, bytes, generated_by,
            supersedes_id, superseded_by_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 'generated', ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ).run(
        id,
        artist.id,
        reportType,
        range.start,
        range.end,
        paymentFilter === "all" ? null : paymentFilter,
        bookingFilter === "all" ? null : bookingFilter,
        storageKey,
        pdfHash,
        dataHash,
        pdf.byteLength,
        artist.id,
        previous?.id ?? null,
        createdAt,
      );

      if (previous) {
        db.prepare(
          "UPDATE artist_reports SET superseded_by_id = ? WHERE id = ? AND artist_id = ?",
        ).run(id, previous.id, artist.id);
      }

      return {
        id,
        artist_id: artist.id,
        report_type: reportType,
        period_start: range.start,
        period_end: range.end,
        payment_status: paymentFilter === "all" ? null : paymentFilter,
        booking_status: bookingFilter === "all" ? null : bookingFilter,
        currency: "USD",
        status: "generated",
        storage_key: storageKey,
        pdf_sha256: pdfHash,
        data_sha256: dataHash,
        bytes: pdf.byteLength,
        generated_by: artist.id,
        supersedes_id: previous?.id ?? null,
        superseded_by_id: null,
        created_at: createdAt,
      } satisfies ArtistReport;
    });
  } catch (error) {
    console.error("Report metadata could not be saved", error);
    await deletePrivateFile(storageKey);
    return { ok: false, error: "Could not record the generated report. Try again." };
  }

  writeAudit({
    actorId: artist.id,
    actorName: artist.name,
    actorRole: artist.role,
    action: "report.generated",
    entityType: "artist_report",
    entityId: id,
    after: {
      reportType,
      periodStart: range.start,
      periodEnd: range.end,
      paymentFilter,
      bookingFilter,
      pdfSha256: pdfHash,
      dataSha256: dataHash,
      bytes: pdf.byteLength,
      supersedes: report.supersedes_id,
    },
    ip,
  });

  return { ok: true, reportId: id, report };
}

export async function readArtistReportPdf(report: ArtistReport) {
  try {
    const bytes = await readPrivateFile(report.storage_key);
    if (hashBytes(bytes) !== report.pdf_sha256) {
      return { ok: false as const, error: "The stored report does not match its recorded hash." };
    }
    return { ok: true as const, bytes };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false as const, error: "The stored report file is missing." };
    }
    throw error;
  }
}

export function reportDownloadName(report: ArtistReport) {
  return `EventIQ-${report.report_type}-${report.period_start}-to-${report.period_end}.pdf`;
}
