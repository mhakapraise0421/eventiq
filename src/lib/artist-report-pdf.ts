import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { harareDayKey } from "./calendar";
import {
  ARTIST_REPORT_TYPE_LABEL,
  BOOKING_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatCivilDate,
  formatDateTime,
  formatMoneyExact,
} from "./format";
import type { ArtistAnalytics } from "./artist-analytics";
import type {
  ArtistBookingWithEvent,
  ArtistInvoice,
  ArtistPayment,
  ArtistReportType,
  ReportBookingFilter,
  ReportPaymentFilter,
} from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(10 / 255, 10 / 255, 15 / 255);
const MUTED = rgb(98 / 255, 98 / 255, 110 / 255);
const FAINT = rgb(148 / 255, 148 / 255, 160 / 255);
const LINE = rgb(228 / 255, 228 / 255, 231 / 255);
const SURFACE = rgb(246 / 255, 246 / 255, 248 / 255);
const WHITE = rgb(1, 1, 1);
const PURPLE = rgb(96 / 255, 38 / 255, 217 / 255);
const DEEP = rgb(44 / 255, 15 / 255, 102 / 255);
const CYAN = rgb(34 / 255, 211 / 255, 238 / 255);

function safe(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  let output = safe(text);
  if (font.widthOfTextAtSize(output, size) <= maxWidth) return output;
  while (output.length > 1 && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output.trimEnd()}...`;
}

function roundedRect(
  page: PDFPage,
  options: { x: number; yTop: number; width: number; height: number; radius: number; color: RGB },
) {
  const { x, yTop, width, height, color } = options;
  const radius = Math.min(options.radius, width / 2, height / 2);
  const path = [
    `M ${radius} 0`,
    `H ${width - radius}`,
    `A ${radius} ${radius} 0 0 1 ${width} ${radius}`,
    `V ${height - radius}`,
    `A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,
    `H ${radius}`,
    `A ${radius} ${radius} 0 0 1 0 ${height - radius}`,
    `V ${radius}`,
    `A ${radius} ${radius} 0 0 1 ${radius} 0`,
    "Z",
  ].join(" ");
  page.drawSvgPath(path, { x, y: PAGE_HEIGHT - yTop - height, color });
}

function money(cents: number, currency: string) {
  return formatMoneyExact(cents, currency);
}

export interface ReportPdfInput {
  reportId: string;
  reportType: ArtistReportType;
  artistName: string;
  range: { start: string; end: string };
  generatedAt: string;
  currency: string;
  analytics: ArtistAnalytics;
  paymentFilter: ReportPaymentFilter;
  bookingFilter: ReportBookingFilter;
  paymentRows: ArtistPayment[];
  outstandingRows: ArtistInvoice[];
  bookingRows: ArtistBookingWithEvent[];
  activityRows: Array<{ label: string; value: number; note: string }>;
  dataHash: string;
}

class ReportBuilder {
  page: PDFPage;
  y: number;
  pages: PDFPage[] = [];

  constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly header: { title: string; subtitle: string; right: string },
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);
    this.drawHeader(true);
    this.y = 128;
  }

  drawHeader(first: boolean) {
    const page = this.page;
    if (first) {
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 92, width: PAGE_WIDTH, height: 92, color: DEEP });
      page.drawRectangle({ x: PAGE_WIDTH * 0.55, y: PAGE_HEIGHT - 92, width: PAGE_WIDTH * 0.45, height: 92, color: PURPLE });
      page.drawRectangle({ x: PAGE_WIDTH * 0.86, y: PAGE_HEIGHT - 92, width: PAGE_WIDTH * 0.14, height: 92, color: CYAN });

      const eventWidth = this.bold.widthOfTextAtSize("Event", 21);
      page.drawText("Event", { x: MARGIN, y: PAGE_HEIGHT - 44, size: 21, font: this.bold, color: WHITE });
      page.drawText("IQ", { x: MARGIN + eventWidth, y: PAGE_HEIGHT - 44, size: 21, font: this.bold, color: CYAN });
      page.drawText(safe(this.header.subtitle), {
        x: MARGIN,
        y: PAGE_HEIGHT - 62,
        size: 8.5,
        font: this.regular,
        color: rgb(0.85, 0.82, 0.95),
      });
      page.drawText(safe(this.header.right), {
        x: PAGE_WIDTH - MARGIN - this.regular.widthOfTextAtSize(safe(this.header.right), 8.5),
        y: PAGE_HEIGHT - 44,
        size: 8.5,
        font: this.regular,
        color: rgb(0.9, 0.9, 0.95),
      });
      page.drawText(
        safe(
          ARTIST_REPORT_TYPE_LABEL[this.header.title] || this.header.title,
        ),
        {
          x: PAGE_WIDTH - MARGIN - this.bold.widthOfTextAtSize(
            safe(ARTIST_REPORT_TYPE_LABEL[this.header.title] || this.header.title),
            9,
          ),
          y: PAGE_HEIGHT - 62,
          size: 9,
          font: this.bold,
          color: WHITE,
        },
      );
      return;
    }
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 54, width: PAGE_WIDTH, height: 54, color: DEEP });
    page.drawText("EventIQ", { x: MARGIN, y: PAGE_HEIGHT - 33, size: 12, font: this.bold, color: WHITE });
    page.drawText(
      safe(ARTIST_REPORT_TYPE_LABEL[this.header.title] || this.header.title),
      {
        x: PAGE_WIDTH - MARGIN - this.regular.widthOfTextAtSize(
          safe(ARTIST_REPORT_TYPE_LABEL[this.header.title] || this.header.title),
          8.5,
        ),
        y: PAGE_HEIGHT - 33,
        size: 8.5,
        font: this.regular,
        color: rgb(0.86, 0.86, 0.94),
      },
    );
  }

  ensure(space: number) {
    if (this.y + space <= PAGE_HEIGHT - 68) return;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);
    this.drawHeader(false);
    this.y = 74;
  }

  text(
    value: string,
    options: { size?: number; font?: PDFFont; color?: RGB; x?: number; maxWidth?: number } = {},
  ) {
    const size = options.size ?? 9;
    const font = options.font ?? this.regular;
    const x = options.x ?? MARGIN;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
    this.ensure(size + 6);
    this.page.drawText(fit(value, font, size, maxWidth), {
      x,
      y: PAGE_HEIGHT - this.y,
      size,
      font,
      color: options.color ?? INK,
    });
    this.y += size + 5;
  }

  paragraph(value: string, options: { size?: number; color?: RGB } = {}) {
    const size = options.size ?? 8.5;
    for (const line of wrap(value, this.regular, size, CONTENT_WIDTH)) {
      this.text(line, { size, color: options.color ?? MUTED });
    }
    this.y += 3;
  }

  section(title: string) {
    this.ensure(30);
    this.y += 8;
    this.text(title, { size: 11.5, font: this.bold, color: INK });
    this.y += 2;
  }

  metaRow(label: string, value: string) {
    this.ensure(15);
    this.page.drawText(safe(label), {
      x: MARGIN,
      y: PAGE_HEIGHT - this.y,
      size: 8.5,
      font: this.regular,
      color: FAINT,
    });
    this.page.drawText(fit(value, this.bold, 8.5, CONTENT_WIDTH - 120), {
      x: MARGIN + 120,
      y: PAGE_HEIGHT - this.y,
      size: 8.5,
      font: this.bold,
      color: INK,
    });
    this.y += 14;
  }

  summaryGrid(items: Array<{ label: string; value: string; note: string }>) {
    const gap = 10;
    const width = (CONTENT_WIDTH - gap) / 2;
    const height = 54;
    for (let index = 0; index < items.length; index += 2) {
      this.ensure(height + gap);
      for (let column = 0; column < 2; column += 1) {
        const item = items[index + column];
        if (!item) continue;
        const x = MARGIN + column * (width + gap);
        roundedRect(this.page, {
          x,
          yTop: this.y,
          width,
          height,
          radius: 8,
          color: SURFACE,
        });
        this.page.drawText(item.label.toUpperCase(), {
          x: x + 12,
          y: PAGE_HEIGHT - this.y - 17,
          size: 7,
          font: this.bold,
          color: MUTED,
        });
        this.page.drawText(fit(item.value, this.bold, 14, width - 24), {
          x: x + 12,
          y: PAGE_HEIGHT - this.y - 35,
          size: 14,
          font: this.bold,
          color: INK,
        });
        this.page.drawText(fit(item.note, this.regular, 7, width - 24), {
          x: x + 12,
          y: PAGE_HEIGHT - this.y - 47,
          size: 7,
          font: this.regular,
          color: FAINT,
        });
      }
      this.y += height + gap;
    }
  }

  table(
    headers: string[],
    widths: number[],
    rows: string[][],
    options: { align?: Array<"left" | "right">; tone?: Array<RGB | null> } = {},
  ) {
    const total = widths.reduce((sum, width) => sum + width, 0);
    const scaled = widths.map((width) => (width / total) * CONTENT_WIDTH);

    const drawHeaders = () => {
      this.ensure(22);
      let x = MARGIN;
      this.page.drawRectangle({
        x: MARGIN,
        y: PAGE_HEIGHT - this.y - 14,
        width: CONTENT_WIDTH,
        height: 18,
        color: SURFACE,
      });
      headers.forEach((header, index) => {
        this.page.drawText(safe(header).toUpperCase(), {
          x: x + 6,
          y: PAGE_HEIGHT - this.y - 9,
          size: 6.8,
          font: this.bold,
          color: MUTED,
        });
        x += scaled[index];
      });
      this.y += 20;
    };

    drawHeaders();
    if (!rows.length) {
      this.text("No records in this period.", { size: 8.5, color: FAINT });
      return;
    }

    for (const row of rows) {
      if (this.y + 18 > PAGE_HEIGHT - 68) {
        this.ensure(22);
        drawHeaders();
      }
      let x = MARGIN;
      row.forEach((cell, index) => {
        const align = options.align?.[index] ?? "left";
        const color = options.tone?.[index] ?? INK;
        const text = fit(cell, this.regular, 7.8, scaled[index] - 12);
        const width = this.regular.widthOfTextAtSize(text, 7.8);
        this.page.drawText(text, {
          x: align === "right" ? x + scaled[index] - 6 - width : x + 6,
          y: PAGE_HEIGHT - this.y - 9,
          size: 7.8,
          font: options.tone?.[index] ? this.bold : this.regular,
          color,
        });
        x += scaled[index];
      });
      this.page.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - this.y - 14 },
        end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - this.y - 14 },
        thickness: 0.4,
        color: LINE,
      });
      this.y += 17;
    }
  }

  finish() {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN, y: 50 },
        end: { x: PAGE_WIDTH - MARGIN, y: 50 },
        thickness: 0.5,
        color: LINE,
      });
      page.drawText(safe(`EventIQ · ${this.header.right} · Not audited financial statements`), {
        x: MARGIN,
        y: 38,
        size: 6.8,
        font: this.regular,
        color: FAINT,
      });
      const label = `Page ${index + 1} of ${total}`;
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN - this.regular.widthOfTextAtSize(label, 6.8),
        y: 38,
        size: 6.8,
        font: this.regular,
        color: FAINT,
      });
    });
    return this.doc.save();
  }
}

function filterLabel(paymentFilter: ReportPaymentFilter, bookingFilter: ReportBookingFilter) {
  const parts: string[] = [];
  if (paymentFilter !== "all") {
    parts.push(`Payment status: ${PAYMENT_STATUS_LABEL[paymentFilter] || paymentFilter}`);
  }
  if (bookingFilter !== "all") {
    parts.push(`Booking status: ${BOOKING_STATUS_LABEL[bookingFilter] || bookingFilter}`);
  }
  return parts.length ? parts.join(" · ") : "No additional filters";
}

export async function buildArtistReportPdf(input: ReportPdfInput) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { analytics, currency, range } = input;

  doc.setTitle(`${ARTIST_REPORT_TYPE_LABEL[input.reportType]} — ${safe(input.artistName)}`);
  doc.setAuthor("EventIQ");
  doc.setSubject(`Report ${input.reportId}`);
  doc.setCreationDate(new Date(input.generatedAt));

  const builder = new ReportBuilder(doc, regular, bold, {
    title: input.reportType,
    subtitle: "Artist financial report · private document",
    right: input.reportId,
  });

  builder.text(ARTIST_REPORT_TYPE_LABEL[input.reportType], { size: 19, font: bold });
  builder.text(`${safe(input.artistName)}`, { size: 10, font: bold, color: MUTED });
  builder.y += 4;
  builder.metaRow("Reporting period", `${formatCivilDate(range.start)} – ${formatCivilDate(range.end)}`);
  builder.metaRow("Reporting currency", currency);
  builder.metaRow("Generated", formatDateTime(input.generatedAt));
  builder.metaRow("Filters", filterLabel(input.paymentFilter, input.bookingFilter));
  builder.metaRow("Report ID", input.reportId);

  builder.section("Financial summary");
  builder.summaryGrid([
    {
      label: "Contracted earnings",
      value: money(analytics.totals.contractedCents, currency),
      note: "Accepted agreements, by event date",
    },
    {
      label: "Payments received",
      value: money(analytics.totals.receivedCents, currency),
      note: "Artist-confirmed payments in period",
    },
    {
      label: "Outstanding",
      value: money(analytics.totals.outstandingCents, currency),
      note: "Agreed fees minus confirmed payments",
    },
    {
      label: "Overdue",
      value: money(analytics.totals.overdueCents, currency),
      note: "Open invoices due in period and past due",
    },
  ]);

  builder.section("Monthly breakdown");
  builder.table(
    ["Month", "Contracted", "Received", "Difference"],
    [2, 1.4, 1.4, 1.4],
    analytics.months.map((month) => [
      month.label,
      money(month.contractedCents, currency),
      money(month.receivedCents, currency),
      money(month.receivedCents - month.contractedCents, currency),
    ]),
    { align: ["left", "right", "right", "right"] },
  );

  builder.section("Booking activity");
  builder.table(
    ["Metric", "Value"],
    [3, 1],
    [
      ["Total booking requests in period", String(analytics.bookings.totalRequests)],
      ["Confirmed bookings", String(analytics.bookings.confirmed)],
      ["Completed performances", String(analytics.bookings.completed)],
      ["Cancelled bookings", String(analytics.bookings.cancelled)],
      ["Declined requests", String(analytics.bookings.declined)],
      [
        "Acceptance rate",
        analytics.bookings.acceptanceRatePct === null
          ? "Not available"
          : `${analytics.bookings.acceptanceRatePct}%`,
      ],
      [
        "Average contracted fee per completed performance",
        analytics.bookings.averageFeePerCompletedCents === null
          ? "No completed performances"
          : money(analytics.bookings.averageFeePerCompletedCents, currency),
      ],
    ],
    { align: ["left", "right"] },
  );

  if (input.paymentRows.length || input.reportType === "payment_history" || input.reportType === "custom_financial") {
    builder.section("Payment records");
    builder.table(
      ["Date", "Event", "Amount", "Method", "Status", "Reference"],
      [0.9, 2.6, 0.9, 1.2, 1.5, 1.4],
      input.paymentRows.map((payment) => [
        formatCivilDate(payment.paid_on),
        payment.event_title || "—",
        money(payment.amount_cents, currency),
        PAYMENT_METHOD_LABEL[payment.method] || payment.method,
        PAYMENT_STATUS_LABEL[payment.status] || payment.status,
        payment.reference || "—",
      ]),
      { align: ["left", "left", "right", "left", "left", "left"] },
    );
  }

  if (input.reportType === "outstanding_payments") {
    builder.section("Open invoices due in period");
    builder.table(
      ["Invoice", "Event", "Due", "Amount", "Confirmed", "Balance"],
      [1.5, 2.4, 1.1, 1.1, 1.1, 1.1],
      input.outstandingRows.map((invoice) => {
        const balance = invoice.amount_cents - Number(invoice.received_cents || 0);
        return [
          invoice.number,
          invoice.event_title || "—",
          formatCivilDate(invoice.due_on),
          money(invoice.amount_cents, currency),
          money(Number(invoice.received_cents || 0), currency),
          money(balance, currency),
        ];
      }),
      { align: ["left", "left", "left", "right", "right", "right"] },
    );
  }

  if (input.reportType === "booking_performance") {
    builder.section("Booking records");
    builder.table(
      ["Event", "Date", "Status", "Agreed fee", "Received"],
      [2.7, 1.4, 1.2, 1.1, 1.1],
      input.bookingRows.map((booking) => {
        const agreement = analytics.agreements.find((row) => row.booking_id === booking.id);
        return [
          booking.event_title,
          formatCivilDate(harareDayKey(booking.event_starts_at)),
          BOOKING_STATUS_LABEL[booking.status] || booking.status,
          agreement?.accepted_fee_cents != null
            ? money(agreement.accepted_fee_cents, currency)
            : "No accepted agreement",
          money(Number(agreement?.payments_received_cents || 0), currency),
        ];
      }),
      { align: ["left", "left", "left", "right", "right"] },
    );
  }

  if (input.reportType === "artist_activity") {
    builder.section("Activity in period");
    builder.table(
      ["Activity", "Count", "Definition"],
      [2, 0.8, 4],
      input.activityRows.map((row) => [row.label, String(row.value), row.note]),
      { align: ["left", "right", "left"] },
    );
  }

  builder.section("Definitions");
  const definitions = [
    "Contracted earnings are agreed fees on accepted agreements, grouped by the event date and excluding cancelled engagements.",
    "Payments received are payments the artist has confirmed as received, using the date the payment was made.",
    "Outstanding balances are agreed fees minus confirmed payments for engagements in the period, as at report generation.",
    "Overdue balances are unpaid invoice balances whose due date falls inside the period and has already passed.",
    "Average fee per completed performance uses accepted agreements for performances whose event date has passed.",
    "This report is generated from EventIQ records. It is not audited financial statements, a tax document or proof of payment beyond the records shown.",
  ];
  for (const line of definitions) builder.paragraph(`• ${line}`, { size: 8 });

  builder.section("Report integrity");
  builder.metaRow("Report status", "Generated");
  builder.metaRow("Data snapshot SHA-256", input.dataHash);
  builder.paragraph(
    "The report PDF is stored privately and its SHA-256 hash is recorded server-side at generation. EventIQ never replaces a generated report: if the underlying records change, a new report gets a new ID and the earlier report is kept.",
    { size: 7.5 },
  );

  return builder.finish();
}
