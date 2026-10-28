import "server-only";
import { all, get, run } from "./db";
import { writeAudit } from "./audit";
import { randomId } from "./format";
import type {
  ArtistAvailability,
  ArtistBookingWithEvent,
  ArtistProfileWithUser,
  User,
} from "./types";

const MAX_FEE_CENTS = 10_000_000;
const MAX_AVAILABILITY_DAYS = 90;
const MAX_MESSAGE = 1000;
const MAX_NOTE = 500;

type Result = { ok: true } | { ok: false; error: string };

const BOOKING_SELECT = `
  SELECT b.*,
         e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at,
         e.ends_at AS event_ends_at, e.venue AS event_venue, e.city AS event_city,
         e.status AS event_status,
         ap.stage_name AS artist_stage_name, ap.slug AS artist_slug,
         ap.verification_status AS artist_verification_status,
         ou.name AS organizer_name, op.business_name AS organizer_business,
         ou.email AS organizer_email, ou.phone AS organizer_phone
  FROM artist_bookings b
  JOIN events e ON e.id = b.event_id
  JOIN users au ON au.id = b.artist_id
  JOIN artist_profiles ap ON ap.user_id = b.artist_id
  JOIN users ou ON ou.id = b.organizer_id
  LEFT JOIN organizer_profiles op ON op.user_id = b.organizer_id`;

function eventWindow(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 3 * 60 * 60_000;
  return { start, end: end > start ? end : start + 3 * 60 * 60_000 };
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && bStart < aEnd;
}

export function parseProposedFee(
  value: unknown,
): { ok: true; cents: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, cents: null };
  }
  const raw = typeof value === "number" ? String(value) : String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) {
    return {
      ok: false,
      error: "Enter a proposed fee like 350 or 350.50, or leave it blank to discuss.",
    };
  }
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (cents > MAX_FEE_CENTS) {
    return { ok: false, error: "That proposed fee is too high for this form." };
  }
  return { ok: true, cents };
}

export function listArtistBookings(artistId: string): ArtistBookingWithEvent[] {
  return all<ArtistBookingWithEvent>(
    `${BOOKING_SELECT} WHERE b.artist_id = ? ORDER BY e.starts_at ASC, b.created_at DESC`,
    artistId,
  );
}

export function listOrganizerBookings(organizerId: string): ArtistBookingWithEvent[] {
  return all<ArtistBookingWithEvent>(
    `${BOOKING_SELECT} WHERE b.organizer_id = ? ORDER BY b.created_at DESC`,
    organizerId,
  );
}

export function getBookingForArtist(id: string, artistId: string) {
  return get<ArtistBookingWithEvent>(
    `${BOOKING_SELECT} WHERE b.id = ? AND b.artist_id = ?`,
    id,
    artistId,
  );
}

export function listOrganizerBookableEvents(organizerId: string) {
  return all<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue: string;
    status: string;
  }>(
    `SELECT id, title, starts_at, ends_at, venue, status
     FROM events
     WHERE organizer_id = ? AND status NOT IN ('cancelled', 'completed')
       AND starts_at > ?
     ORDER BY starts_at ASC`,
    organizerId,
    new Date().toISOString(),
  );
}

/** Published artists who have not switched booking requests off. */
export function listBookableArtists(): ArtistProfileWithUser[] {
  return all<ArtistProfileWithUser>(
    `SELECT ap.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM artist_profiles ap
     JOIN users u ON u.id = ap.user_id
     WHERE ap.visibility = 'published' AND ap.accepting_bookings = 1
       AND u.status = 'active' AND u.role = 'artist'
     ORDER BY ap.stage_name ASC`,
  );
}

export function listArtistAvailability(
  artistId: string,
  fromIso?: string,
  toIso?: string,
): ArtistAvailability[] {
  if (fromIso && toIso) {
    return all<ArtistAvailability>(
      `SELECT * FROM artist_availability
       WHERE artist_id = ? AND starts_at < ? AND ends_at > ?
       ORDER BY starts_at ASC`,
      artistId,
      toIso,
      fromIso,
    );
  }
  return all<ArtistAvailability>(
    "SELECT * FROM artist_availability WHERE artist_id = ? ORDER BY starts_at ASC",
    artistId,
  );
}

function availabilityConflict(artistId: string, start: number, end: number) {
  const blocks = listArtistAvailability(artistId);
  return blocks.find((block) =>
    overlaps(start, end, new Date(block.starts_at).getTime(), new Date(block.ends_at).getTime()),
  );
}

function acceptedConflict(
  artistId: string,
  start: number,
  end: number,
  excludeBookingId?: string,
) {
  const accepted = all<ArtistBookingWithEvent>(
    `${BOOKING_SELECT} WHERE b.artist_id = ? AND b.status = 'accepted'`,
    artistId,
  );
  return accepted.find((booking) => {
    if (booking.id === excludeBookingId) return false;
    const window = eventWindow(booking.event_starts_at, booking.event_ends_at);
    return overlaps(start, end, window.start, window.end);
  });
}

function audit(
  actor: User,
  action: string,
  entityType: string,
  entityId: string,
  after: Record<string, unknown>,
  ip?: string | null,
  before?: Record<string, unknown>,
) {
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    before,
    after,
    ip,
  });
}

export function createBookingRequest(
  input: {
    artistId?: string;
    eventId?: string;
    proposedFee?: unknown;
    message?: string;
  },
  organizer: User,
  ip?: string | null,
): { ok: true; bookingId: string } | { ok: false; error: string } {
  const artistId = (input.artistId || "").trim();
  const eventId = (input.eventId || "").trim();
  if (!artistId || !eventId) return { ok: false, error: "Choose an artist and one of your events." };

  const message = (input.message || "").trim().slice(0, MAX_MESSAGE);
  const fee = parseProposedFee(input.proposedFee);
  if (!fee.ok) return { ok: false, error: fee.error };

  const artist = get<{ user_id: string; visibility: string; accepting_bookings: number }>(
    `SELECT ap.user_id, ap.visibility, ap.accepting_bookings
     FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
     WHERE ap.user_id = ? AND u.role = 'artist' AND u.status = 'active'`,
    artistId,
  );
  if (!artist) return { ok: false, error: "That artist is not available for booking." };
  if (artist.visibility !== "published") {
    return { ok: false, error: "That artist has not published a public profile yet." };
  }
  if (!artist.accepting_bookings) {
    return { ok: false, error: "That artist is not accepting booking requests right now." };
  }

  const event = get<{
    id: string;
    title: string;
    status: string;
    starts_at: string;
    ends_at: string | null;
    organizer_id: string;
  }>("SELECT id, title, status, starts_at, ends_at, organizer_id FROM events WHERE id = ?", eventId);
  if (!event || event.organizer_id !== organizer.id) {
    return { ok: false, error: "Choose one of your own events." };
  }
  if (["cancelled", "completed"].includes(event.status)) {
    return { ok: false, error: "That event is no longer open for booking requests." };
  }
  const window = eventWindow(event.starts_at, event.ends_at);
  if (window.start <= Date.now()) {
    return { ok: false, error: "That event has already started or passed." };
  }

  const existing = get<{ id: string; status: string }>(
    "SELECT id, status FROM artist_bookings WHERE artist_id = ? AND event_id = ? AND status IN ('requested', 'accepted')",
    artistId,
    eventId,
  );
  if (existing) {
    return {
      ok: false,
      error:
        existing.status === "accepted"
          ? "This artist is already confirmed for that event."
          : "A booking request for this artist and event is already pending.",
    };
  }

  const blocked = availabilityConflict(artistId, window.start, window.end);
  if (blocked) {
    return { ok: false, error: "The artist is marked unavailable for that time." };
  }
  const clash = acceptedConflict(artistId, window.start, window.end);
  if (clash) {
    return {
      ok: false,
      error: `The artist already has a confirmed booking for ${clash.event_title} around that time.`,
    };
  }

  const id = randomId("bkg_");
  run(
    `INSERT INTO artist_bookings
       (id, artist_id, organizer_id, event_id, status, proposed_fee_cents, currency, message, response_note, created_at, responded_at)
     VALUES (?, ?, ?, ?, 'requested', ?, 'USD', ?, NULL, ?, NULL)`,
    id,
    artistId,
    organizer.id,
    eventId,
    fee.cents,
    message || null,
    new Date().toISOString(),
  );

  audit(organizer, "booking.requested", "artist_booking", id, {
    artistId,
    eventId,
    eventTitle: event.title,
    proposedFeeCents: fee.cents,
  }, ip);
  return { ok: true, bookingId: id };
}

export function withdrawBooking(
  bookingId: string,
  organizer: User,
  ip?: string | null,
): Result {
  const booking = get<{ id: string; status: string; event_id: string; artist_id: string }>(
    "SELECT id, status, event_id, artist_id FROM artist_bookings WHERE id = ? AND organizer_id = ?",
    bookingId,
    organizer.id,
  );
  if (!booking) return { ok: false, error: "Booking request not found." };
  if (booking.status !== "requested") {
    return { ok: false, error: "Only pending requests can be withdrawn." };
  }
  run(
    "UPDATE artist_bookings SET status = 'withdrawn', responded_at = ? WHERE id = ? AND status = 'requested'",
    new Date().toISOString(),
    bookingId,
  );
  audit(organizer, "booking.withdrawn", "artist_booking", bookingId, {
    eventId: booking.event_id,
    artistId: booking.artist_id,
  }, ip, { status: "requested" });
  return { ok: true };
}

export function acceptBooking(
  bookingId: string,
  artist: User,
  ip?: string | null,
): Result {
  const booking = getBookingForArtist(bookingId, artist.id);
  if (!booking) return { ok: false, error: "Booking request not found." };
  if (booking.status !== "requested") {
    return { ok: false, error: "This request is no longer awaiting your response." };
  }
  if (["cancelled", "completed"].includes(booking.event_status)) {
    return { ok: false, error: "The organizer has cancelled or completed this event." };
  }
  const window = eventWindow(booking.event_starts_at, booking.event_ends_at);
  if (window.start <= Date.now()) {
    return { ok: false, error: "This event has already started or passed." };
  }
  const blocked = availabilityConflict(artist.id, window.start, window.end);
  if (blocked) {
    return {
      ok: false,
      error: "This event overlaps an unavailable block on your calendar. Remove the block first.",
    };
  }
  const clash = acceptedConflict(artist.id, window.start, window.end, booking.id);
  if (clash) {
    return {
      ok: false,
      error: `You already have a confirmed booking for ${clash.event_title} at that time.`,
    };
  }

  const now = new Date().toISOString();
  const result = run(
    "UPDATE artist_bookings SET status = 'accepted', responded_at = ? WHERE id = ? AND artist_id = ? AND status = 'requested'",
    now,
    bookingId,
    artist.id,
  );
  if (Number(result.changes) === 0) {
    return { ok: false, error: "This request changed while you were responding. Reload and try again." };
  }
  audit(artist, "booking.accepted", "artist_booking", bookingId, {
    eventId: booking.event_id,
    eventTitle: booking.event_title,
    organizerId: booking.organizer_id,
  }, ip, { status: "requested" });
  return { ok: true };
}

function noteValue(note: string | undefined) {
  const text = (note || "").trim().slice(0, MAX_NOTE);
  return text;
}

export function declineBooking(
  bookingId: string,
  artist: User,
  note: string | undefined,
  ip?: string | null,
): Result {
  const reason = noteValue(note);
  if (reason.length < 3) return { ok: false, error: "Add a short reason so the organizer understands." };
  const booking = getBookingForArtist(bookingId, artist.id);
  if (!booking) return { ok: false, error: "Booking request not found." };
  if (booking.status !== "requested") {
    return { ok: false, error: "This request is no longer awaiting your response." };
  }
  const result = run(
    `UPDATE artist_bookings SET status = 'declined', response_note = ?, responded_at = ?
     WHERE id = ? AND artist_id = ? AND status = 'requested'`,
    reason,
    new Date().toISOString(),
    bookingId,
    artist.id,
  );
  if (Number(result.changes) === 0) {
    return { ok: false, error: "This request changed while you were responding. Reload and try again." };
  }
  audit(artist, "booking.declined", "artist_booking", bookingId, {
    eventId: booking.event_id,
    note: reason,
  }, ip, { status: "requested" });
  return { ok: true };
}

export function cancelBooking(
  bookingId: string,
  artist: User,
  note: string | undefined,
  ip?: string | null,
): Result {
  const reason = noteValue(note);
  if (reason.length < 3) return { ok: false, error: "Add a short reason for cancelling." };
  const booking = getBookingForArtist(bookingId, artist.id);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.status !== "accepted") {
    return { ok: false, error: "Only confirmed bookings can be cancelled." };
  }
  const result = run(
    `UPDATE artist_bookings SET status = 'cancelled', response_note = ?, responded_at = ?
     WHERE id = ? AND artist_id = ? AND status = 'accepted'`,
    reason,
    new Date().toISOString(),
    bookingId,
    artist.id,
  );
  if (Number(result.changes) === 0) {
    return { ok: false, error: "This booking changed while you were responding. Reload and try again." };
  }
  audit(artist, "booking.cancelled", "artist_booking", bookingId, {
    eventId: booking.event_id,
    note: reason,
  }, ip, { status: "accepted" });
  return { ok: true };
}

export function addAvailability(
  input: { startsAt?: string; endsAt?: string; note?: string },
  artist: User,
  ip?: string | null,
): Result {
  const starts = new Date(input.startsAt || "");
  const ends = new Date(input.endsAt || "");
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    return { ok: false, error: "Choose a valid start and end date and time." };
  }
  if (ends.getTime() <= starts.getTime()) {
    return { ok: false, error: "The unavailable period must end after it starts." };
  }
  if (ends.getTime() <= Date.now()) {
    return { ok: false, error: "Choose a period that ends in the future." };
  }
  if (ends.getTime() - starts.getTime() > MAX_AVAILABILITY_DAYS * 24 * 60 * 60_000) {
    return { ok: false, error: `Unavailable blocks can be at most ${MAX_AVAILABILITY_DAYS} days long.` };
  }
  const note = (input.note || "").trim().slice(0, 200);

  const existing = availabilityConflict(artist.id, starts.getTime(), ends.getTime());
  if (existing) {
    return { ok: false, error: "This overlaps an unavailable block you already saved." };
  }
  const clash = acceptedConflict(artist.id, starts.getTime(), ends.getTime());
  if (clash) {
    return {
      ok: false,
      error: `This overlaps your confirmed booking for ${clash.event_title}. Cancel that booking first.`,
    };
  }

  const id = randomId("avl_");
  run(
    "INSERT INTO artist_availability (id, artist_id, starts_at, ends_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    artist.id,
    starts.toISOString(),
    ends.toISOString(),
    note || null,
    new Date().toISOString(),
  );
  audit(artist, "availability.added", "artist_availability", id, {
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    note: note || null,
  }, ip);
  return { ok: true };
}

export function removeAvailability(
  availabilityId: string,
  artist: User,
  ip?: string | null,
): Result {
  const block = get<ArtistAvailability>(
    "SELECT * FROM artist_availability WHERE id = ? AND artist_id = ?",
    availabilityId,
    artist.id,
  );
  if (!block) return { ok: false, error: "Unavailable block not found." };
  run("DELETE FROM artist_availability WHERE id = ? AND artist_id = ?", availabilityId, artist.id);
  audit(artist, "availability.removed", "artist_availability", availabilityId, {}, ip, {
    startsAt: block.starts_at,
    endsAt: block.ends_at,
    note: block.note,
  });
  return { ok: true };
}

export function setAcceptingBookings(
  artistId: string,
  accepting: boolean,
  artist: User,
  ip?: string | null,
): Result {
  const before = get<{ accepting_bookings: number }>(
    "SELECT accepting_bookings FROM artist_profiles WHERE user_id = ?",
    artistId,
  );
  if (!before) return { ok: false, error: "Artist profile not found." };
  run(
    "UPDATE artist_profiles SET accepting_bookings = ?, updated_at = ? WHERE user_id = ?",
    accepting ? 1 : 0,
    new Date().toISOString(),
    artistId,
  );
  audit(artist, "artist.booking_settings", "artist_profile", artistId, { accepting }, ip, {
    accepting: !!before.accepting_bookings,
  });
  return { ok: true };
}

export function bookingCounts(artistId: string) {
  const rows = all<{ status: string; count: number }>(
    "SELECT status, COUNT(*) AS count FROM artist_bookings WHERE artist_id = ? GROUP BY status",
    artistId,
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}
