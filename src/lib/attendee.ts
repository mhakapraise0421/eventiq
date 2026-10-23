import "server-only";
import { all, get, run, transaction } from "./db";
import { EVENT_SELECT } from "./events";
import { getUserTickets } from "./orders";
import { CATEGORIES } from "./format";
import type { EventRecord } from "./types";

export function listFavoriteEventIds(userId: string): string[] {
  return all<{ event_id: string }>(
    "SELECT event_id FROM favorite_events WHERE user_id = ?",
    userId,
  ).map((row) => row.event_id);
}

export function listFavoriteEvents(userId: string, limit = 24): EventRecord[] {
  return all<EventRecord>(
    `${EVENT_SELECT} JOIN favorite_events f ON f.event_id = e.id
     WHERE f.user_id = ? AND e.status = 'approved' AND e.starts_at >= ?
     ORDER BY f.created_at DESC LIMIT ?`,
    userId,
    new Date().toISOString(),
    limit,
  );
}

export function toggleFavoriteEvent(userId: string, eventId: string): boolean {
  const event = get<{ id: string }>(
    "SELECT id FROM events WHERE id = ? AND status = 'approved'",
    eventId,
  );
  if (!event) throw new Error("Event not found.");
  const existing = get<{ user_id: string }>(
    "SELECT user_id FROM favorite_events WHERE user_id = ? AND event_id = ?",
    userId,
    eventId,
  );
  if (existing) {
    run(
      "DELETE FROM favorite_events WHERE user_id = ? AND event_id = ?",
      userId,
      eventId,
    );
    return false;
  }
  run(
    "INSERT INTO favorite_events (user_id, event_id, created_at) VALUES (?, ?, ?)",
    userId,
    eventId,
    new Date().toISOString(),
  );
  return true;
}

export function recordEventView(userId: string, eventId: string) {
  const event = get<{ id: string }>("SELECT id FROM events WHERE id = ?", eventId);
  if (!event) return;
  run(
    `INSERT INTO recently_viewed_events (user_id, event_id, viewed_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id, event_id) DO UPDATE SET viewed_at = excluded.viewed_at`,
    userId,
    eventId,
    new Date().toISOString(),
  );
}

export function listRecentlyViewedEvents(userId: string, limit = 6): EventRecord[] {
  return all<EventRecord>(
    `${EVENT_SELECT} JOIN recently_viewed_events r ON r.event_id = e.id
     WHERE r.user_id = ? AND e.status = 'approved'
     ORDER BY r.viewed_at DESC LIMIT ?`,
    userId,
    limit,
  );
}

export function listUserInterests(userId: string): string[] {
  return all<{ category: string }>(
    "SELECT category FROM user_interests WHERE user_id = ? ORDER BY created_at ASC",
    userId,
  ).map((row) => row.category);
}

export function setUserInterests(userId: string, categories: string[]) {
  const valid = [...new Set(categories)].filter((category) =>
    (CATEGORIES as readonly string[]).includes(category),
  );
  transaction((db) => {
    db.prepare("DELETE FROM user_interests WHERE user_id = ?").run(userId);
    const insert = db.prepare(
      "INSERT INTO user_interests (user_id, category, created_at) VALUES (?, ?, ?)",
    );
    valid.forEach((category, index) => {
      insert.run(userId, category, new Date(Date.now() + index).toISOString());
    });
  });
  return valid;
}

export function listTrendingEvents(limit = 4): EventRecord[] {
  return all<EventRecord>(
    `${EVENT_SELECT} WHERE e.status = 'approved' AND e.starts_at >= ?
     ORDER BY tickets_sold DESC, e.starts_at ASC LIMIT ?`,
    new Date().toISOString(),
    limit,
  );
}

export function listRecommendedEvents(userId: string, limit = 4): EventRecord[] {
  const interests = new Set(listUserInterests(userId));
  const user = get<{ city: string | null }>("SELECT city FROM users WHERE id = ?", userId);
  const city = user?.city || null;
  const ownedEventIds = new Set(
    all<{ event_id: string }>(
      `SELECT DISTINCT t.event_id FROM tickets t
       JOIN orders o ON o.id = t.order_id
       WHERE o.user_id = ? AND o.status IN ('paid', 'partially_refunded') AND t.status = 'valid'`,
      userId,
    ).map((row) => row.event_id),
  );
  const candidates = all<EventRecord>(
    `${EVENT_SELECT} WHERE e.status = 'approved' AND e.starts_at >= ?
     ORDER BY e.starts_at ASC LIMIT 40`,
    new Date().toISOString(),
  );
  const scored = candidates
    .filter((event) => !ownedEventIds.has(event.id))
    .map((event) => {
      let score = 0;
      if (interests.has(event.category)) score += 4;
      if (city && event.city === city) score += 2;
      if (event.featured) score += 1;
      return { event, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.event.starts_at.localeCompare(b.event.starts_at))
    .slice(0, limit)
    .map((item) => item.event);
  return scored;
}

export function listEventReminders(userId: string, withinDays = 7) {
  const cutoff = Date.now() + withinDays * 24 * 3600_000;
  return getUserTickets(userId).filter(
    (ticket) =>
      ticket.status === "valid" &&
      new Date(ticket.event_starts_at || 0).getTime() >= Date.now() &&
      new Date(ticket.event_starts_at || 0).getTime() <= cutoff,
  );
}
