import "server-only";
import { all } from "@/lib/db";
import { EVENT_SELECT } from "@/lib/events";
import { CITIES } from "@/lib/format";
import type { EventRecord } from "@/lib/types";
import type { IqSource } from "./types";

const HARARE_OFFSET_MS = 2 * 60 * 60 * 1000;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const CATEGORY_SYNONYMS: Array<[string, string[]]> = [
  ["Concerts", ["concert", "concerts", "live music", "music", "gig", "gigs", "performance"]],
  ["Festivals", ["festival", "festivals", "fest"]],
  ["Nightlife", ["nightlife", "club", "clubs", "clubbing", "dj", "djs"]],
  ["Parties", ["party", "parties", "celebration", "celebration"]],
  ["Weddings & Roora", ["wedding", "weddings", "roora", "lobola"]],
  ["Church", ["church", "gospel", "worship"]],
  ["School", ["school", "schools"]],
  ["Proms", ["prom", "proms"]],
  ["Comedy", ["comedy", "comedian", "comedians", "stand-up", "standup"]],
  [
    "Sports",
    ["sports", "sport", "match", "matches", "football", "soccer", "rugby", "cricket", "netball"],
  ],
  ["Conferences", ["conference", "conferences", "summit", "networking", "workshop", "workshops"]],
  ["Corporate", ["corporate", "team building"]],
];

const STOP_WORDS = new Set(
  [
    "what", "whats", "when", "where", "which", "who", "how", "why", "is", "are", "was", "were",
    "on", "in", "at", "to", "for", "of", "the", "and", "or", "with", "me", "my", "mine", "i",
    "we", "you", "your", "can", "could", "should", "would", "will", "do", "does", "did", "any",
    "some", "something", "anything", "events", "event", "happening", "happen", "going", "go",
    "show", "shows", "find", "looking", "look", "see", "list", "tell", "about", "please",
    "thanks", "thank", "hi", "hello", "hey", "upcoming", "this", "that", "these", "those",
    "next", "coming", "around", "near", "tonight", "today", "tomorrow", "weekend", "week",
    "month", "year", "free", "under", "below", "less", "than", "up", "max", "maximum", "over",
    "above", "more", "between", "cheap", "affordable", "best", "good", "great", "nice", "fun",
    "thing", "things", "want", "need", "help", "know", "there", "here", "have", "has", "all",
    "new", "live", "night", "nights", "music", "gig", "gigs", "date", "dates", "time", "times",
    "now", "still", "available", "tickets", "ticket", "prices", "price", "cost", "costs",
    "something", "anything", "day", "days", "evening", "arena", "venue", "venues", "city",
  ].concat(
    MONTHS,
    WEEKDAYS,
    WEEKDAYS.map((day) => day.slice(0, 3)),
    CITIES.map((city) => city.toLowerCase()),
    CITIES.flatMap((city) => city.toLowerCase().split(/\s+/)),
    CATEGORY_SYNONYMS.flatMap(([, words]) => words),
  ),
);

export interface DiscoveryFilters {
  city?: string;
  category?: string;
  startISO?: string;
  endISO?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  freeOnly?: boolean;
  q?: string;
  dateLabel?: string;
  priceLabel?: string;
}

export interface DiscoveryResult {
  events: EventRecord[];
  filters: DiscoveryFilters;
  relaxedKeyword: boolean;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function harareCivil(now: Date, addDays = 0) {
  const shifted = new Date(now.getTime() + HARARE_OFFSET_MS + addDays * 86_400_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function weekdayIndex(civil: string) {
  return new Date(`${civil}T12:00:00+02:00`).getUTCDay();
}

function dayStart(civil: string) {
  return new Date(`${civil}T00:00:00+02:00`).toISOString();
}

function dayEnd(civil: string) {
  return new Date(`${civil}T23:59:59+02:00`).toISOString();
}

function addDays(civil: string, days: number) {
  const base = new Date(`${civil}T12:00:00+02:00`);
  return harareCivil(base, days);
}

function lastDayOfMonth(year: number, monthIndex: number) {
  const day = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function civilLabel(civil: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Harare",
  }).format(new Date(`${civil}T12:00:00+02:00`));
}

function monthFromToken(token: string) {
  const normalized = token.slice(0, 3).toLowerCase();
  return MONTHS.findIndex((month) => month.slice(0, 3) === normalized);
}

function detectCity(lower: string) {
  if (/\b(vic falls|vfalls|vic-falls)\b/.test(lower)) return "Victoria Falls";
  const match = CITIES.filter((city) => lower.includes(city.toLowerCase())).sort(
    (a, b) => b.length - a.length,
  )[0];
  return match;
}

function detectCategory(lower: string) {
  for (const category of CATEGORY_SYNONYMS) {
    const [name, words] = category;
    if (words.some((word) => new RegExp(`\\b${word.replace(/[-/]/g, "[-/ ]")}\\b`).test(lower))) {
      return name;
    }
  }
  return undefined;
}

function detectDate(lower: string, now: Date): { startISO?: string; endISO?: string; label?: string } {
  const today = harareCivil(now);
  const nowISO = now.toISOString();

  const iso = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) {
    return { startISO: dayStart(iso[1]), endISO: dayEnd(iso[1]), label: `on ${civilLabel(iso[1])}` };
  }

  const dayMonth = lower.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*,?\s*(20\d{2}))?/,
  );
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthIndex = monthFromToken(dayMonth[2]);
    let year = dayMonth[3] ? Number(dayMonth[3]) : Number(today.slice(0, 4));
    let civil = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
    if (!dayMonth[3] && civil < today) {
      year += 1;
      civil = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
    }
    return { startISO: dayStart(civil), endISO: dayEnd(civil), label: `on ${civilLabel(civil)}` };
  }

  const nextWeekend = /\bnext weekend\b/.test(lower);
  if (/\bweekend\b/.test(lower)) {
    const daysToSunday = (7 - weekdayIndex(today)) % 7;
    const offset = nextWeekend ? daysToSunday + 7 : daysToSunday;
    const sunday = addDays(today, offset);
    return {
      startISO: nextWeekend ? dayStart(addDays(sunday, -2)) : nowISO,
      endISO: dayEnd(sunday),
      label: nextWeekend ? "next weekend" : "this weekend",
    };
  }

  if (/\b(tonight|today)\b/.test(lower)) {
    return { startISO: nowISO, endISO: dayEnd(today), label: "today" };
  }
  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = addDays(today, 1);
    return { startISO: dayStart(tomorrow), endISO: dayEnd(tomorrow), label: "tomorrow" };
  }
  if (/\bnext week\b/.test(lower)) {
    const start = addDays(today, 7);
    return { startISO: dayStart(start), endISO: dayEnd(addDays(today, 13)), label: "next week" };
  }
  if (/\b(this week|coming week|in the next week)\b/.test(lower)) {
    return { startISO: nowISO, endISO: dayEnd(addDays(today, 7)), label: "in the next 7 days" };
  }
  if (/\bnext month\b/.test(lower)) {
    const base = new Date(`${today}T12:00:00+02:00`);
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonth = (month + 1) % 12;
    return {
      startISO: dayStart(`${nextYear}-${pad(nextMonth + 1)}-01`),
      endISO: dayEnd(lastDayOfMonth(nextYear, nextMonth)),
      label: "next month",
    };
  }
  if (/\bthis month\b/.test(lower)) {
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7)) - 1;
    return {
      startISO: nowISO,
      endISO: dayEnd(lastDayOfMonth(year, month)),
      label: "this month",
    };
  }

  const monthOnly = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s+(20\d{2}))?/,
  );
  if (monthOnly) {
    const monthIndex = monthFromToken(monthOnly[1]);
    const currentYear = Number(today.slice(0, 4));
    const currentMonth = Number(today.slice(5, 7)) - 1;
    const year = monthOnly[2]
      ? Number(monthOnly[2])
      : monthIndex >= currentMonth
        ? currentYear
        : currentYear + 1;
    return {
      startISO: dayStart(`${year}-${pad(monthIndex + 1)}-01`),
      endISO: dayEnd(lastDayOfMonth(year, monthIndex)),
      label: `in ${MONTHS[monthIndex].charAt(0).toUpperCase()}${MONTHS[monthIndex].slice(1)}`,
    };
  }

  const weekday = lower.match(
    /\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/,
  );
  if (weekday) {
    const token = weekday[1];
    const target = WEEKDAYS.findIndex((day) => day.startsWith(token.slice(0, 3)));
    if (target >= 0) {
      const offset = (target - weekdayIndex(today) + 7) % 7;
      if (offset === 0) {
        return { startISO: nowISO, endISO: dayEnd(today), label: `on ${WEEKDAYS[target]}` };
      }
      const civil = addDays(today, offset);
      return { startISO: dayStart(civil), endISO: dayEnd(civil), label: `on ${civilLabel(civil)}` };
    }
  }

  return {};
}

function detectPrice(lower: string): { minPriceCents?: number; maxPriceCents?: number; freeOnly?: boolean; priceLabel?: string } {
  if (/\b(free|no charge|zero)\b/.test(lower)) {
    return { freeOnly: true, priceLabel: "free" };
  }

  const toCents = (raw: string) => Math.round(Number(raw) * 100);

  const between = lower.match(
    /(?:\$|usd\s*)?(\d{1,4})\s*(?:-|–|to|and)\s*\$?(\d{1,4})(?!\s*(?:am|pm|:\d{2}))/,
  );
  if (between && /(\$|usd|dollars|between)/.test(lower)) {
    const first = Number(between[1]);
    const second = Number(between[2]);
    const min = Math.min(first, second);
    const max = Math.max(first, second);
    if (max > 0) {
      return {
        minPriceCents: toCents(String(min)),
        maxPriceCents: toCents(String(max)),
        priceLabel: `between $${min} and $${max}`,
      };
    }
  }

  const maxMatch = lower.match(
    /(?:under|below|less than|up to|max(?:imum)?(?: of)?|cheaper than)\s*\$?\s*(\d{1,4})(k)?/,
  );
  if (maxMatch) {
    const amount = Number(maxMatch[1]) * (maxMatch[2] ? 1000 : 1);
    if (amount > 0) {
      return { maxPriceCents: amount * 100, priceLabel: `up to $${amount}` };
    }
  }

  const minMatch = lower.match(/(?:over|above|more than|at least)\s*\$?\s*(\d{1,4})(k)?/);
  if (minMatch) {
    const amount = Number(minMatch[1]) * (minMatch[2] ? 1000 : 1);
    if (amount > 0) {
      return { minPriceCents: amount * 100, priceLabel: `over $${amount}` };
    }
  }

  return {};
}

function detectKeyword(lower: string, used: DiscoveryFilters) {
  const tokens = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const excluded = new Set(STOP_WORDS);
  if (used.city) {
    for (const part of used.city.toLowerCase().split(/\s+/)) excluded.add(part);
  }
  if (used.category) {
    excluded.add(used.category.toLowerCase());
    for (const [, words] of CATEGORY_SYNONYMS) {
      if (words.length) words.forEach((word) => excluded.add(word));
    }
  }
  const candidates = tokens.filter((token) => token.length >= 4 && !excluded.has(token));
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

export function interpretQuestion(message: string, now = new Date()): DiscoveryFilters {
  const lower = message.toLowerCase();
  const city = detectCity(lower);
  const category = detectCategory(lower);
  const date = detectDate(lower, now);
  const price = detectPrice(lower);
  const filters: DiscoveryFilters = {
    city,
    category,
    startISO: date.startISO,
    endISO: date.endISO,
    dateLabel: date.label,
    ...price,
  };
  const keyword = detectKeyword(lower, filters);
  if (keyword) filters.q = keyword;
  return filters;
}

function queryEvents(filters: DiscoveryFilters, limit: number) {
  const clauses: string[] = ["e.status = 'approved'", "e.starts_at >= ?"];
  const params: (string | number)[] = [new Date().toISOString()];

  if (filters.city) {
    clauses.push("e.city = ?");
    params.push(filters.city);
  }
  if (filters.category) {
    clauses.push("e.category = ?");
    params.push(filters.category);
  }
  if (filters.startISO) {
    clauses.push("e.starts_at >= ?");
    params.push(filters.startISO);
  }
  if (filters.endISO) {
    clauses.push("e.starts_at <= ?");
    params.push(filters.endISO);
  }
  if (filters.freeOnly) {
    clauses.push("(SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) = 0");
  }
  if (typeof filters.minPriceCents === "number") {
    clauses.push("(SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) >= ?");
    params.push(filters.minPriceCents);
  }
  if (typeof filters.maxPriceCents === "number") {
    clauses.push("(SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) <= ?");
    params.push(filters.maxPriceCents);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    clauses.push("(e.title LIKE ? OR e.tagline LIKE ? OR e.venue LIKE ?)");
    params.push(like, like, like);
  }

  const sql = `${EVENT_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY e.starts_at ASC LIMIT ?`;
  return all<EventRecord>(sql, ...params, limit);
}

/**
 * Public discovery only ever reads approved, upcoming events. No attendee,
 * order or artist-private data is included in the result.
 */
export function searchPublicEvents(message: string, now = new Date()): DiscoveryResult {
  const filters = interpretQuestion(message, now);
  let events = queryEvents(filters, 8);
  let relaxedKeyword = false;

  if (!events.length && filters.q) {
    const withoutKeyword: DiscoveryFilters = { ...filters };
    delete withoutKeyword.q;
    const retry = queryEvents(withoutKeyword, 8);
    if (retry.length) {
      events = retry;
      relaxedKeyword = true;
      delete filters.q;
    }
  }

  if (!events.length && !filters.city && !filters.category && !filters.startISO && !filters.priceLabel) {
    events = queryEvents({}, 5);
  }

  return { events, filters, relaxedKeyword };
}

export function describeFilters(filters: DiscoveryFilters) {
  if (!filters.category && !filters.city && !filters.dateLabel && !filters.priceLabel && !filters.q) {
    return "the next events on EventIQ";
  }
  const category = filters.category?.toLowerCase();
  let noun = category
    ? category.endsWith("s")
      ? category
      : `${category} events`
    : "events";
  if (filters.freeOnly) noun = `free ${noun}`;
  else if (filters.priceLabel) noun = `${noun} ${filters.priceLabel}`;

  const parts = [noun];
  if (filters.city) parts.push(`in ${filters.city}`);
  if (filters.dateLabel) parts.push(filters.dateLabel);
  if (filters.q) parts.push(`matching “${filters.q}”`);
  return parts.join(" ");
}

export function toIqSource(event: EventRecord): IqSource {
  const from = typeof event.min_price_cents === "number" ? event.min_price_cents : null;
  return {
    slug: event.slug,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    venue: event.venue,
    city: event.city,
    category: event.category,
    priceFromCents: from,
    isFree: from === 0,
  };
}
