export const BRAND = {
  name: "EventIQ",
  accent: "#020E99",
  secondary: "#22D3EE",
  supportEmail: "support@eventiq.co.zw",
  city: "Harare, Zimbabwe",
};

export const SERVICE_FEE_RATE = 0.05;
export const COMMISSION_RATE = 0.08;
export const RESERVATION_MINUTES = 20;

export const CATEGORIES = [
  "Concerts",
  "Festivals",
  "Nightlife",
  "Parties",
  "Weddings & Roora",
  "Church",
  "School",
  "Conferences",
  "Corporate",
  "Other",
] as const;

export const CITIES = [
  "Harare",
  "Bulawayo",
  "Victoria Falls",
  "Mutare",
  "Gweru",
  "Masvingo",
] as const;

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatMoneyExact(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Harare",
});

const dateShortFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Harare",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Africa/Harare",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Africa/Harare",
});

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

export function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  return dateShortFmt.format(new Date(iso));
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return timeFmt.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return dateTimeFmt.format(new Date(iso));
}

export function formatTimeRange(
  startIso: string | null | undefined,
  endIso?: string | null,
) {
  if (!startIso) return "—";
  const start = formatTime(startIso);
  if (!endIso) return start;
  return `${start} – ${formatTime(endIso)}`;
}

export function formatDayParts(iso: string) {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      timeZone: "Africa/Harare",
    }).format(d),
    month: new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: "Africa/Harare",
    })
      .format(d)
      .toUpperCase(),
    weekday: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "Africa/Harare",
    }).format(d),
  };
}

export function harareInputToISO(value: string) {
  return new Date(`${value}:00+02:00`).toISOString();
}

export function isoToHarareInput(iso: string | null | undefined) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Harare",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function randomId(prefix = "") {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "")}`;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function ticketCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `EVQ-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

export function orderReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const suffix = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `ORD-${suffix}`;
}

export function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Pending review",
  approved: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const ROLE_LABEL: Record<string, string> = {
  attendee: "Attendee",
  organizer: "Organizer",
  gate: "Gate staff",
  admin: "Administrator",
  ceo: "CEO",
};

export function statusTone(status: string) {
  switch (status) {
    case "approved":
    case "paid":
    case "active":
    case "accepted":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "pending":
    case "duplicate":
    case "requires_modification":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "rejected":
    case "invalid":
    case "wrong_event":
    case "not_paid":
    case "suspended":
    case "cancelled":
      return "bg-rose-50 text-rose-700 border border-rose-200";
    case "refunded":
    case "partially_refunded":
      return "bg-violet-50 text-violet-700 border border-violet-200";
    case "draft":
    case "expired":
    case "void":
    case "retired":
      return "bg-zinc-100 text-zinc-600 border border-zinc-200";
    case "used":
    case "completed":
      return "bg-sky-50 text-sky-700 border border-sky-200";
    default:
      return "bg-zinc-100 text-zinc-600 border border-zinc-200";
  }
}
