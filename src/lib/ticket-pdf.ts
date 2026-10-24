import "server-only";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import type { Ticket } from "./types";
import { signTicketCode } from "./ticket-code";
import { BRAND, formatDate, formatDateTime, formatTimeRange } from "./format";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CARD_X = 40;
const CARD_W = PAGE_WIDTH - 80;
const CARD_TOP = 778;
const CARD_BOTTOM = 64;
const HEADER_H = 122;
const HEADER_BOTTOM = CARD_TOP - HEADER_H;

const INK = rgb(10 / 255, 10 / 255, 15 / 255);
const MUTED = rgb(98 / 255, 98 / 255, 110 / 255);
const FAINT = rgb(148 / 255, 148 / 255, 160 / 255);
const LINE = rgb(228 / 255, 228 / 255, 231 / 255);
const SURFACE = rgb(244 / 255, 244 / 255, 245 / 255);
const WHITE = rgb(1, 1, 1);
const PURPLE = rgb(96 / 255, 38 / 255, 217 / 255);
const CYAN = rgb(34 / 255, 211 / 255, 238 / 255);
const EMERALD = rgb(4 / 255, 120 / 255, 87 / 255);
const EMERALD_BG = rgb(236 / 255, 253 / 255, 245 / 255);
const SLATE = rgb(71 / 255, 85 / 255, 105 / 255);
const SLATE_BG = rgb(241 / 255, 245 / 255, 249 / 255);
const ROSE = rgb(190 / 255, 18 / 255, 60 / 255);
const ROSE_BG = rgb(255 / 255, 241 / 255, 242 / 255);

type RGBTriplet = [number, number, number];

const GRADIENT_STOPS: Array<{ at: number; color: RGBTriplet }> = [
  { at: 0, color: [44, 15, 102] },
  { at: 0.55, color: [96, 38, 217] },
  { at: 1, color: [124, 58, 237] },
];

function gradientColor(t: number): RGB {
  const clamped = Math.min(1, Math.max(0, t));
  let start = GRADIENT_STOPS[0];
  let end = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i += 1) {
    if (clamped >= GRADIENT_STOPS[i].at && clamped <= GRADIENT_STOPS[i + 1].at) {
      start = GRADIENT_STOPS[i];
      end = GRADIENT_STOPS[i + 1];
      break;
    }
  }
  const span = end.at - start.at || 1;
  const ratio = (clamped - start.at) / span;
  return rgb(
    (start.color[0] + (end.color[0] - start.color[0]) * ratio) / 255,
    (start.color[1] + (end.color[1] - start.color[1]) * ratio) / 255,
    (start.color[2] + (end.color[2] - start.color[2]) * ratio) / 255,
  );
}

function safeText(value: string | null | undefined, fallback = "") {
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let output = text;
  while (output.length > 1 && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output.trimEnd()}...`;
}

function drawRoundedRect(
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
  page.drawSvgPath(path, { x, y: yTop, color });
}

function drawMark(page: PDFPage, x: number, y: number, size: number, barColor: RGB, arrowColor: RGB) {
  const unit = size / 44;
  const bar = 9 * unit;
  const stem = 9 * unit;
  drawRoundedRect(page, {
    x,
    yTop: y + size,
    width: stem,
    height: size,
    radius: stem / 2,
    color: barColor,
  });
  drawRoundedRect(page, {
    x,
    yTop: y + size,
    width: 29 * unit,
    height: bar,
    radius: bar / 2,
    color: barColor,
  });
  drawRoundedRect(page, {
    x,
    yTop: y + size - 17.5 * unit,
    width: 18.5 * unit,
    height: bar,
    radius: bar / 2,
    color: barColor,
  });
  drawRoundedRect(page, {
    x,
    yTop: y + bar,
    width: 29 * unit,
    height: bar,
    radius: bar / 2,
    color: barColor,
  });
  page.drawSvgPath(`M 0 0 L ${11.5 * unit} ${8 * unit} L 0 ${16 * unit} Z`, {
    x: x + 27 * unit,
    y: y + 30 * unit,
    color: arrowColor,
  });
}

function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  page.drawText(text.toUpperCase(), { x, y, size: 7.5, font, color: FAINT });
}

export async function buildTicketPdf(ticket: Ticket): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const eventTitle = safeText(ticket.event_title, "EventIQ event");
  const category = safeText(ticket.event_category, "Event ticket");
  const holder = safeText(ticket.holder_name, "Ticket holder");
  const ticketType = safeText(ticket.ticket_type_name, "General admission");
  const venue = safeText(ticket.venue, "Venue to be confirmed");
  const city = safeText(ticket.city);
  const startsAt = ticket.event_starts_at || ticket.issued_at;
  const dateLine = safeText(formatDate(startsAt));
  const timeLine = safeText(`${formatTimeRange(ticket.event_starts_at, ticket.event_ends_at)} CAT`);
  const issuedLine = safeText(formatDateTime(ticket.issued_at));
  const isUsed = ticket.status === "used";
  const isVoid = ticket.status === "void";

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: SURFACE });
  page.drawRectangle({
    x: CARD_X,
    y: CARD_BOTTOM,
    width: CARD_W,
    height: CARD_TOP - CARD_BOTTOM,
    color: WHITE,
  });

  const strips = 120;
  for (let i = 0; i < strips; i += 1) {
    page.drawRectangle({
      x: CARD_X + (CARD_W * i) / strips,
      y: HEADER_BOTTOM,
      width: CARD_W / strips + 0.4,
      height: HEADER_H,
      color: gradientColor(i / (strips - 1)),
    });
  }
  page.drawRectangle({ x: CARD_X, y: HEADER_BOTTOM, width: CARD_W, height: 4, color: CYAN });

  drawMark(page, CARD_X + 28, HEADER_BOTTOM + 41, 40, WHITE, CYAN);
  page.drawText("Event", {
    x: CARD_X + 80,
    y: HEADER_BOTTOM + 62,
    size: 21,
    font: bold,
    color: WHITE,
  });
  const eventWordWidth = bold.widthOfTextAtSize("Event", 21);
  page.drawText("IQ", {
    x: CARD_X + 80 + eventWordWidth,
    y: HEADER_BOTTOM + 62,
    size: 21,
    font: bold,
    color: CYAN,
  });
  page.drawText("TICKETS  ·  EVENTS  ·  EXPERIENCES", {
    x: CARD_X + 81,
    y: HEADER_BOTTOM + 46,
    size: 6.5,
    font: bold,
    color: WHITE,
    opacity: 0.62,
  });

  const rightEdge = CARD_X + CARD_W - 26;
  const headerNote = isVoid ? "VOID" : isUsed ? "ADMITTED" : "ADMIT ONE";
  const headerLabel = "E-TICKET";
  page.drawText(headerLabel, {
    x: rightEdge - bold.widthOfTextAtSize(headerLabel, 9),
    y: HEADER_BOTTOM + 64,
    size: 9,
    font: bold,
    color: WHITE,
    opacity: 0.7,
  });
  page.drawText(headerNote, {
    x: rightEdge - regular.widthOfTextAtSize(headerNote, 8),
    y: HEADER_BOTTOM + 49,
    size: 8,
    font: regular,
    color: WHITE,
    opacity: 0.55,
  });

  const innerX = CARD_X + 28;
  const innerW = CARD_W - 56;

  page.drawText(category.toUpperCase(), {
    x: innerX,
    y: 618,
    size: 9,
    font: bold,
    color: PURPLE,
  });

  const titleSize = 25;
  const titleLines = wrapText(eventTitle, bold, titleSize, innerW);
  const visibleTitle = titleLines.slice(0, 2);
  if (titleLines.length > 2) {
    visibleTitle[1] = fitText(titleLines.slice(1).join(" "), bold, titleSize, innerW);
  }
  let titleY = 588;
  for (const line of visibleTitle) {
    page.drawText(line, { x: innerX, y: titleY, size: titleSize, font: bold, color: INK });
    titleY -= 30;
  }

  const infoLabelY = titleY - 2;
  const infoValueY = infoLabelY - 16;
  drawLabel(page, "Date & time", innerX, infoLabelY, bold);
  page.drawText(dateLine, { x: innerX, y: infoValueY, size: 11.5, font: bold, color: INK });
  page.drawText(timeLine, { x: innerX, y: infoValueY - 14, size: 10.5, font: regular, color: MUTED });

  const venueX = 312;
  const venueWidth = CARD_X + CARD_W - 28 - venueX;
  drawLabel(page, "Venue", venueX, infoLabelY, bold);
  const venueLines = wrapText(venue, bold, 11.5, venueWidth).slice(0, 2);
  venueLines.forEach((line, index) => {
    page.drawText(fitText(line, bold, 11.5, venueWidth), {
      x: venueX,
      y: infoValueY - index * 14,
      size: 11.5,
      font: bold,
      color: INK,
    });
  });
  if (city) {
    page.drawText(fitText(city, regular, 10.5, venueWidth), {
      x: venueX,
      y: infoValueY - venueLines.length * 14,
      size: 10.5,
      font: regular,
      color: MUTED,
    });
  }

  const dividerY = 455;
  page.drawLine({
    start: { x: innerX - 12, y: dividerY },
    end: { x: CARD_X + CARD_W - 28, y: dividerY },
    thickness: 1,
    color: LINE,
    dashArray: [5, 5],
  });
  page.drawCircle({ x: CARD_X, y: dividerY, size: 11, color: SURFACE });
  page.drawCircle({ x: CARD_X + CARD_W, y: dividerY, size: 11, color: SURFACE });

  const detailsX = innerX;
  const detailsWidth = 292;
  drawLabel(page, "Ticket holder", detailsX, 421, bold);
  page.drawText(fitText(holder, bold, 14, detailsWidth), {
    x: detailsX,
    y: 405,
    size: 14,
    font: bold,
    color: INK,
  });
  drawLabel(page, "Ticket type", detailsX, 373, bold);
  page.drawText(fitText(ticketType, bold, 12.5, detailsWidth), {
    x: detailsX,
    y: 358,
    size: 12.5,
    font: bold,
    color: INK,
  });
  drawLabel(page, "Ticket code", detailsX, 325, bold);
  page.drawText(ticket.code, { x: detailsX, y: 310, size: 12, font: mono, color: INK });
  drawLabel(page, "Order reference", detailsX, 277, bold);
  page.drawText(safeText(ticket.order_reference, "-"), {
    x: detailsX,
    y: 262,
    size: 11.5,
    font: bold,
    color: INK,
  });
  drawLabel(page, "Issued", detailsX, 229, bold);
  page.drawText(issuedLine, { x: detailsX, y: 214, size: 10.5, font: regular, color: MUTED });

  const qrSize = 144;
  const qrX = CARD_X + CARD_W - 28 - qrSize;
  const statusColor = isVoid ? ROSE : isUsed ? SLATE : EMERALD;
  const statusBg = isVoid ? ROSE_BG : isUsed ? SLATE_BG : EMERALD_BG;
  const statusLabel = isVoid ? "NOT VALID" : isUsed ? "ADMITTED" : "VALID FOR ENTRY";
  drawRoundedRect(page, {
    x: qrX,
    yTop: 421,
    width: qrSize,
    height: 22,
    radius: 11,
    color: statusBg,
  });
  const statusWidth = bold.widthOfTextAtSize(statusLabel, 7.5);
  page.drawText(statusLabel, {
    x: qrX + (qrSize - statusWidth) / 2,
    y: 414,
    size: 7.5,
    font: bold,
    color: statusColor,
  });

  const qrBoxY = 241;
  page.drawRectangle({
    x: qrX,
    y: qrBoxY,
    width: qrSize,
    height: qrSize,
    color: WHITE,
    borderColor: LINE,
    borderWidth: 1,
  });

  if (!isVoid) {
    const qrPng = await QRCode.toBuffer(signTicketCode(ticket.code), {
      type: "png",
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    const qrImage = await doc.embedPng(qrPng);
    page.drawImage(qrImage, {
      x: qrX + 10,
      y: qrBoxY + 10,
      width: qrSize - 20,
      height: qrSize - 20,
    });
  } else {
    const voidWidth = bold.widthOfTextAtSize("VOID", 20);
    page.drawText("VOID", {
      x: qrX + (qrSize - voidWidth) / 2,
      y: qrBoxY + qrSize / 2 - 7,
      size: 20,
      font: bold,
      color: ROSE,
    });
  }

  const caption = isVoid ? "No longer valid" : isUsed ? "Already scanned" : "Scan at the gate";
  const captionWidth = bold.widthOfTextAtSize(caption, 8.5);
  page.drawText(caption, {
    x: qrX + (qrSize - captionWidth) / 2,
    y: 227,
    size: 8.5,
    font: bold,
    color: INK,
  });
  const subCaption = isVoid
    ? "Do not present at the gate"
    : isUsed
      ? ticket.used_at
        ? `Admitted ${safeText(formatDate(ticket.used_at))}`
        : "Admitted"
      : "One admission per ticket";
  const subWidth = regular.widthOfTextAtSize(subCaption, 7);
  page.drawText(subCaption, {
    x: qrX + (qrSize - subWidth) / 2,
    y: 215,
    size: 7,
    font: regular,
    color: MUTED,
  });

  page.drawLine({
    start: { x: innerX, y: 178 },
    end: { x: CARD_X + CARD_W - 28, y: 178 },
    thickness: 1,
    color: LINE,
  });
  drawLabel(page, "Entry terms", innerX, 156, bold);
  const terms =
    "Valid for one admission. This QR code is signed on the server and verified at the gate; duplicate scans are rejected and logged. Bring a valid ID if the event has an age restriction. Tickets cannot be resold outside EventIQ.";
  wrapText(terms, regular, 7.5, innerW)
    .slice(0, 3)
    .forEach((line, index) => {
      page.drawText(line, {
        x: innerX,
        y: 141 - index * 10.5,
        size: 7.5,
        font: regular,
        color: MUTED,
      });
    });

  page.drawText("More Than Just Tickets.", {
    x: innerX,
    y: 94,
    size: 9.5,
    font: bold,
    color: PURPLE,
  });
  const support = `${BRAND.supportEmail}  ·  eventiq.co.zw`;
  page.drawText(support, {
    x: CARD_X + CARD_W - 28 - regular.widthOfTextAtSize(support, 7.5),
    y: 94,
    size: 7.5,
    font: regular,
    color: MUTED,
  });

  page.drawRectangle({
    x: CARD_X,
    y: CARD_BOTTOM,
    width: CARD_W,
    height: CARD_TOP - CARD_BOTTOM,
    borderColor: LINE,
    borderWidth: 1,
  });

  const pageFooter = "Official EventIQ e-ticket  ·  Harare, Zimbabwe";
  page.drawText(pageFooter, {
    x: (PAGE_WIDTH - regular.widthOfTextAtSize(pageFooter, 7)) / 2,
    y: 40,
    size: 7,
    font: regular,
    color: FAINT,
  });

  doc.setTitle(`EventIQ e-ticket - ${eventTitle}`);
  doc.setAuthor(BRAND.name);
  doc.setCreator(BRAND.name);
  doc.setProducer(BRAND.name);
  doc.setSubject(`Ticket ${ticket.code} for ${eventTitle}`);
  doc.setKeywords(["EventIQ", "ticket", eventTitle, ticket.code]);
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  return doc.save();
}
