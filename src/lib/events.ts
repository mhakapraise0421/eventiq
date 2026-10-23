import "server-only";
import { all, get } from "./db";
import type { EventRecord, TicketType } from "./types";

export const EVENT_SELECT = `
  SELECT
    e.*,
    u.name AS organizer_name,
    op.business_name AS organizer_business,
    (SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) AS min_price_cents,
    (SELECT MAX(price_cents) FROM ticket_types WHERE event_id = e.id) AS max_price_cents,
    (SELECT COALESCE(SUM(sold), 0) FROM ticket_types WHERE event_id = e.id) AS tickets_sold,
    (SELECT COALESCE(SUM(capacity), 0) FROM ticket_types WHERE event_id = e.id) AS total_capacity,
    (SELECT COUNT(*) FROM ticket_types WHERE event_id = e.id) AS tier_count
  FROM events e
  JOIN users u ON u.id = e.organizer_id
  LEFT JOIN organizer_profiles op ON op.user_id = e.organizer_id
`;

export interface EventFilters {
  q?: string;
  category?: string;
  city?: string;
  date?: string;
  price?: string;
  availability?: string;
  sort?: string;
}

function harareDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+02:00`);
  const end = new Date(`${dateStr}T23:59:59+02:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function listPublicEvents(filters: EventFilters = {}): EventRecord[] {
  const clauses: string[] = ["e.status = 'approved'", "e.starts_at >= ?"];
  const params: (string | number)[] = [new Date().toISOString()];

  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    clauses.push(
      "(e.title LIKE ? OR e.venue LIKE ? OR e.city LIKE ? OR e.category LIKE ? OR e.tagline LIKE ?)",
    );
    params.push(like, like, like, like, like);
  }
  if (filters.category) {
    clauses.push("e.category = ?");
    params.push(filters.category);
  }
  if (filters.city) {
    clauses.push("e.city = ?");
    params.push(filters.city);
  }
  if (filters.date === "today") {
    const { start, end } = harareDayRange(new Date().toISOString().slice(0, 10));
    clauses.push("e.starts_at >= ? AND e.starts_at <= ?");
    params.push(start, end);
  } else if (filters.date === "week") {
    const end = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    clauses.push("e.starts_at <= ?");
    params.push(end);
  } else if (filters.date === "month") {
    const end = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    clauses.push("e.starts_at <= ?");
    params.push(end);
  }

  if (filters.price === "free") {
    clauses.push("(SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) = 0");
  } else if (filters.price === "under25") {
    clauses.push("(SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) < 2500");
  } else if (filters.price === "25to50") {
    clauses.push(
      "(SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) BETWEEN 2500 AND 5000",
    );
  } else if (filters.price === "over50") {
    clauses.push("(SELECT MIN(price_cents) FROM ticket_types WHERE event_id = e.id) > 5000");
  }

  if (filters.availability === "available") {
    clauses.push(
      "(SELECT COALESCE(SUM(capacity - sold), 0) FROM ticket_types WHERE event_id = e.id) > 0",
    );
  }

  const orderBy =
    filters.sort === "price"
      ? "min_price_cents ASC, e.starts_at ASC"
      : filters.sort === "title"
        ? "e.title ASC"
        : "e.featured DESC, e.starts_at ASC";

  const sql = `${EVENT_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY ${orderBy} LIMIT 60`;
  return all<EventRecord>(sql, ...params);
}

export function listFeaturedEvents(limit = 3): EventRecord[] {
  return all<EventRecord>(
    `${EVENT_SELECT} WHERE e.status = 'approved' AND e.starts_at >= ? ORDER BY e.featured DESC, e.starts_at ASC LIMIT ?`,
    new Date().toISOString(),
    limit,
  );
}

export function listUpcomingEvents(limit = 6): EventRecord[] {
  return all<EventRecord>(
    `${EVENT_SELECT} WHERE e.status = 'approved' AND e.starts_at >= ? ORDER BY e.starts_at ASC LIMIT ?`,
    new Date().toISOString(),
    limit,
  );
}

export function listWeekendEvents(limit = 4): EventRecord[] {
  const now = new Date();
  const harareToday = new Date(now.getTime() + 2 * 3600_000);
  const daysToSunday = (7 - harareToday.getUTCDay()) % 7;
  const sunday = new Date(harareToday);
  sunday.setUTCDate(sunday.getUTCDate() + daysToSunday);
  const end = new Date(`${sunday.toISOString().slice(0, 10)}T23:59:59+02:00`).toISOString();
  return all<EventRecord>(
    `${EVENT_SELECT} WHERE e.status = 'approved' AND e.starts_at >= ? AND e.starts_at <= ? ORDER BY e.starts_at ASC LIMIT ?`,
    now.toISOString(),
    end,
    limit,
  );
}

export function getEventBySlug(slug: string): EventRecord | undefined {
  return get<EventRecord>(`${EVENT_SELECT} WHERE e.slug = ?`, slug);
}

export function getEventById(id: string): EventRecord | undefined {
  return get<EventRecord>(`${EVENT_SELECT} WHERE e.id = ?`, id);
}

export function getTicketTypes(eventId: string): TicketType[] {
  return all<TicketType>(
    "SELECT * FROM ticket_types WHERE event_id = ? ORDER BY sort_order ASC",
    eventId,
  );
}

export function getCategoryCounts(): { category: string; count: number }[] {
  return all<{ category: string; count: number }>(
    "SELECT category, COUNT(*) AS count FROM events WHERE status = 'approved' AND starts_at >= ? GROUP BY category ORDER BY count DESC",
    new Date().toISOString(),
  );
}

export function getPublicEventStats() {
  const row = get<{ events: number; cities: number; tickets: number }>(
    `SELECT
       (SELECT COUNT(*) FROM events WHERE status = 'approved' AND starts_at >= ?) AS events,
       (SELECT COUNT(DISTINCT city) FROM events WHERE status = 'approved' AND starts_at >= ?) AS cities,
       (SELECT COUNT(*) FROM tickets) AS tickets`,
    new Date().toISOString(),
    new Date().toISOString(),
  );
  return {
    events: Number(row?.events || 0),
    cities: Number(row?.cities || 0),
    tickets: Number(row?.tickets || 0),
  };
}

export function listOrganizerEvents(organizerId: string): EventRecord[] {
  return all<EventRecord>(
    `${EVENT_SELECT} WHERE e.organizer_id = ? ORDER BY e.starts_at DESC`,
    organizerId,
  );
}

export function getOrganizerEventsByStatus(organizerId: string, statuses: string[]) {
  const placeholders = statuses.map(() => "?").join(", ");
  return all<EventRecord>(
    `${EVENT_SELECT} WHERE e.organizer_id = ? AND e.status IN (${placeholders}) ORDER BY e.starts_at ASC`,
    organizerId,
    ...statuses,
  );
}

export function listEventsForAdmin(status?: string): EventRecord[] {
  if (status) {
    return all<EventRecord>(
      `${EVENT_SELECT} WHERE e.status = ? ORDER BY e.submitted_at DESC, e.starts_at ASC`,
      status,
    );
  }
  return all<EventRecord>(`${EVENT_SELECT} ORDER BY e.created_at DESC LIMIT 100`);
}
