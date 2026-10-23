import "server-only";
import { all, get, run, transaction } from "./db";
import { writeAudit } from "./audit";
import type { EventRecord, TicketType, User } from "./types";
import { getOrganizerProfile } from "./admin";
import { formatMoney, randomId, slugify } from "./format";

export interface OrganizerTierInput {
  id?: string;
  name: string;
  description?: string;
  priceCents: number;
  capacity: number;
  maxPerOrder?: number;
  perks?: string;
}

export interface OrganizerEventInput {
  title: string;
  tagline?: string;
  description: string;
  category: string;
  city: string;
  venue: string;
  address?: string;
  startsAt: string;
  endsAt?: string;
  coverImage?: string;
  ageLimit?: string;
  terms?: string;
  tiers: OrganizerTierInput[];
}

function uniqueSlug(title: string) {
  const base = slugify(title) || "event";
  let slug = base;
  let suffix = 2;
  while (get<{ id: string }>("SELECT id FROM events WHERE slug = ?", slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function imageFor(input: OrganizerEventInput) {
  if (input.coverImage?.trim()) return input.coverImage.trim();
  const prompt = `premium event cover art for "${input.title}", ${input.category} event in ${input.city}, vibrant stage lighting, crowd, cinematic poster style`;
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt,
  )}&image_size=portrait_4_3`;
}

export function validateEventInput(input: OrganizerEventInput) {
  if (!input.title || input.title.trim().length < 3) return "Enter an event title.";
  if (!input.description || input.description.trim().length < 30) {
    return "Add a description of at least 30 characters.";
  }
  if (!input.category) return "Choose a category.";
  if (!input.city) return "Choose a city.";
  if (!input.venue || input.venue.trim().length < 2) return "Enter the venue name.";
  if (!input.startsAt || Number.isNaN(new Date(input.startsAt).getTime())) {
    return "Enter a valid start date and time.";
  }
  if (input.endsAt && Number.isNaN(new Date(input.endsAt).getTime())) {
    return "Enter a valid end date and time.";
  }
  if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    return "The event must end after it starts.";
  }
  if (!Array.isArray(input.tiers) || input.tiers.length === 0) {
    return "Add at least one ticket type.";
  }
  if (input.tiers.length > 8) return "You can add up to 8 ticket types.";
  const names = new Set<string>();
  for (const tier of input.tiers) {
    const name = (tier.name || "").trim();
    if (name.length < 2) return "Every ticket type needs a name.";
    if (names.has(name.toLowerCase())) return `Duplicate ticket type: ${name}.`;
    names.add(name.toLowerCase());
    if (!Number.isFinite(tier.priceCents) || tier.priceCents < 0) {
      return `${name}: enter a valid price.`;
    }
    if (!Number.isFinite(tier.capacity) || tier.capacity < 1) {
      return `${name}: capacity must be at least 1.`;
    }
    if (tier.maxPerOrder !== undefined && (tier.maxPerOrder < 1 || tier.maxPerOrder > 10)) {
      return `${name}: max per order must be between 1 and 10.`;
    }
  }
  return null;
}

export function createOrganizerEvent(organizerId: string, input: OrganizerEventInput, actor: User) {
  const problem = validateEventInput(input);
  if (problem) return { ok: false as const, error: problem };

  const id = randomId("evt_");
  const slug = uniqueSlug(input.title);
  const now = new Date().toISOString();
  const capacity = input.tiers.reduce((sum, tier) => sum + tier.capacity, 0);

  transaction((db) => {
    db.prepare(
      `INSERT INTO events (id, slug, title, tagline, description, category, city, venue, address,
        starts_at, ends_at, cover_image, organizer_id, status, featured, age_limit, terms, capacity,
        created_at, submitted_at, approved_by, approved_at, rejection_reason, scheme_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)`,
    ).run(
      id,
      slug,
      input.title.trim(),
      input.tagline?.trim() || null,
      input.description.trim(),
      input.category,
      input.city,
      input.venue.trim(),
      input.address?.trim() || null,
      input.startsAt,
      input.endsAt || null,
      imageFor(input),
      organizerId,
      input.ageLimit?.trim() || null,
      input.terms?.trim() || null,
      capacity,
      now,
    );

    input.tiers.forEach((tier, index) => {
      db.prepare(
        `INSERT INTO ticket_types (id, event_id, name, description, price_cents, capacity, sold,
          sales_start, sales_end, max_per_order, perks, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)`,
      ).run(
        randomId("tt_"),
        id,
        tier.name.trim(),
        tier.description?.trim() || null,
        Math.round(tier.priceCents),
        Math.round(tier.capacity),
        tier.maxPerOrder ?? 6,
        tier.perks?.trim() || null,
        index,
      );
    });
  });

  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "event.created",
    entityType: "event",
    entityId: id,
    after: { title: input.title, status: "draft" },
  });

  return { ok: true as const, eventId: id, slug };
}

export function updateOrganizerEvent(
  eventId: string,
  organizerId: string,
  input: OrganizerEventInput,
  actor: User,
) {
  const event = get<EventRecord>(
    "SELECT * FROM events WHERE id = ? AND organizer_id = ?",
    eventId,
    organizerId,
  );
  if (!event) return { ok: false as const, error: "Event not found." };
  if (!["draft", "rejected"].includes(event.status)) {
    return {
      ok: false as const,
      error: "Only draft or rejected events can be edited.",
    };
  }
  const problem = validateEventInput(input);
  if (problem) return { ok: false as const, error: problem };

  const sold = get<{ count: number }>(
    "SELECT COALESCE(SUM(sold), 0) AS count FROM ticket_types WHERE event_id = ?",
    eventId,
  );
  if (Number(sold?.count || 0) > 0) {
    return { ok: false as const, error: "This event already has ticket sales and cannot be restructured." };
  }

  const capacity = input.tiers.reduce((sum, tier) => sum + tier.capacity, 0);
  transaction((db) => {
    db.prepare(
      `UPDATE events SET title = ?, tagline = ?, description = ?, category = ?, city = ?, venue = ?,
        address = ?, starts_at = ?, ends_at = ?, cover_image = ?, age_limit = ?, terms = ?, capacity = ?,
        rejection_reason = NULL, status = CASE WHEN status = 'rejected' THEN 'draft' ELSE status END
       WHERE id = ?`,
    ).run(
      input.title.trim(),
      input.tagline?.trim() || null,
      input.description.trim(),
      input.category,
      input.city,
      input.venue.trim(),
      input.address?.trim() || null,
      input.startsAt,
      input.endsAt || null,
      imageFor(input),
      input.ageLimit?.trim() || null,
      input.terms?.trim() || null,
      capacity,
      eventId,
    );

    db.prepare("DELETE FROM ticket_types WHERE event_id = ?").run(eventId);
    input.tiers.forEach((tier, index) => {
      db.prepare(
        `INSERT INTO ticket_types (id, event_id, name, description, price_cents, capacity, sold,
          sales_start, sales_end, max_per_order, perks, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)`,
      ).run(
        randomId("tt_"),
        eventId,
        tier.name.trim(),
        tier.description?.trim() || null,
        Math.round(tier.priceCents),
        Math.round(tier.capacity),
        tier.maxPerOrder ?? 6,
        tier.perks?.trim() || null,
        index,
      );
    });
  });

  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "event.updated",
    entityType: "event",
    entityId: eventId,
    before: { title: event.title, status: event.status },
    after: { title: input.title, status: "draft" },
  });

  return { ok: true as const };
}

export function submitOrganizerEvent(eventId: string, organizerId: string, actor: User) {
  const event = get<EventRecord>(
    "SELECT * FROM events WHERE id = ? AND organizer_id = ?",
    eventId,
    organizerId,
  );
  if (!event) return { ok: false as const, error: "Event not found." };
  if (!["draft", "rejected"].includes(event.status)) {
    return { ok: false as const, error: "This event has already been submitted." };
  }
  if (new Date(event.starts_at).getTime() < Date.now()) {
    return { ok: false as const, error: "The event start date must be in the future." };
  }
  const tiers = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM ticket_types WHERE event_id = ?",
    eventId,
  );
  if (Number(tiers?.count || 0) === 0) {
    return { ok: false as const, error: "Add at least one ticket type before submitting." };
  }

  run(
    "UPDATE events SET status = 'pending', submitted_at = ?, rejection_reason = NULL WHERE id = ?",
    new Date().toISOString(),
    eventId,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "event.submitted",
    entityType: "event",
    entityId: eventId,
    before: { status: event.status },
    after: { status: "pending" },
  });
  return { ok: true as const };
}

export function createPriceRequest(
  eventId: string,
  ticketTypeId: string,
  newPriceCents: number,
  note: string,
  organizerId: string,
  actor: User,
) {
  const event = get<EventRecord>(
    "SELECT * FROM events WHERE id = ? AND organizer_id = ?",
    eventId,
    organizerId,
  );
  if (!event) return { ok: false as const, error: "Event not found." };
  if (!["approved", "pending"].includes(event.status)) {
    return { ok: false as const, error: "Price changes are only available for submitted events." };
  }
  const tier = get<TicketType>(
    "SELECT * FROM ticket_types WHERE id = ? AND event_id = ?",
    ticketTypeId,
    eventId,
  );
  if (!tier) return { ok: false as const, error: "Ticket type not found." };
  if (!Number.isFinite(newPriceCents) || newPriceCents < 0) {
    return { ok: false as const, error: "Enter a valid new price." };
  }
  if (Math.round(newPriceCents) === tier.price_cents) {
    return { ok: false as const, error: "The new price must differ from the current price." };
  }
  const existing = get<{ id: string }>(
    "SELECT id FROM price_requests WHERE ticket_type_id = ? AND status = 'pending'",
    ticketTypeId,
  );
  if (existing) {
    return { ok: false as const, error: "There is already a pending price request for this ticket type." };
  }

  const id = randomId("pr_");
  run(
    `INSERT INTO price_requests (id, event_id, ticket_type_id, old_price_cents, new_price_cents,
      requested_by, status, note, reviewed_by, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?)`,
    id,
    eventId,
    ticketTypeId,
    tier.price_cents,
    Math.round(newPriceCents),
    organizerId,
    note.trim() || null,
    new Date().toISOString(),
  );

  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "price_change.requested",
    entityType: "ticket_type",
    entityId: ticketTypeId,
    before: { price_cents: tier.price_cents },
    after: {
      price_cents: Math.round(newPriceCents),
      event: event.title,
      current: formatMoney(tier.price_cents),
    },
  });

  return { ok: true as const, requestId: id };
}

export function upsertOrganizerApplication(
  userId: string,
  data: {
    businessName: string;
    businessType: string;
    registrationNo?: string;
    city?: string;
    website?: string;
    description: string;
    kycDocument?: string;
  },
  actor: User,
) {
  const existing = getOrganizerProfile(userId);
  if (existing?.status === "approved") {
    return { ok: false as const, error: "Your organizer account is already approved." };
  }

  const now = new Date().toISOString();
  transaction((db) => {
    if (existing) {
      db.prepare(
        `UPDATE organizer_profiles SET business_name = ?, business_type = ?, registration_no = ?,
          city = ?, website = ?, description = ?, kyc_document = ?, status = 'pending',
          decision_note = NULL, reviewed_by = NULL, reviewed_at = NULL
         WHERE user_id = ?`,
      ).run(
        data.businessName,
        data.businessType,
        data.registrationNo || null,
        data.city || null,
        data.website || null,
        data.description,
        data.kycDocument || null,
        userId,
      );
    } else {
      db.prepare(
        `INSERT INTO organizer_profiles (user_id, business_name, business_type, registration_no, city,
          website, description, kyc_document, status, decision_note, reviewed_by, reviewed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)`,
      ).run(
        userId,
        data.businessName,
        data.businessType,
        data.registrationNo || null,
        data.city || null,
        data.website || null,
        data.description,
        data.kycDocument || null,
        now,
      );
    }
    if (actor.role === "attendee") {
      db.prepare("UPDATE users SET role = 'organizer' WHERE id = ?").run(userId);
    }
  });

  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "organizer.resubmitted" : "organizer.applied",
    entityType: "organizer",
    entityId: userId,
    before: existing ? { status: existing.status } : undefined,
    after: { status: "pending", business: data.businessName },
  });

  return { ok: true as const };
}

export function listOrganizerOrders(organizerId: string, limit = 50) {
  return all<{
    id: string;
    reference: string;
    status: string;
    total_cents: number;
    commission_cents: number;
    created_at: string;
    paid_at: string | null;
    user_name: string;
    user_email: string;
    event_title: string;
  }>(
    `SELECT o.id, o.reference, o.status, o.total_cents, o.commission_cents, o.created_at, o.paid_at,
            u.name AS user_name, u.email AS user_email, e.title AS event_title
     FROM orders o
     JOIN events e ON e.id = o.event_id
     JOIN users u ON u.id = o.user_id
     WHERE e.organizer_id = ?
     ORDER BY o.created_at DESC LIMIT ?`,
    organizerId,
    limit,
  );
}

export function listEventOrders(eventId: string, limit = 30) {
  return all<{
    id: string;
    reference: string;
    status: string;
    total_cents: number;
    created_at: string;
    paid_at: string | null;
    user_name: string;
    user_email: string;
  }>(
    `SELECT o.id, o.reference, o.status, o.total_cents, o.created_at, o.paid_at,
            u.name AS user_name, u.email AS user_email
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE o.event_id = ?
     ORDER BY o.created_at DESC LIMIT ?`,
    eventId,
    limit,
  );
}

export function listOrganizerPriceRequests(organizerId: string) {
  return all<{
    id: string;
    status: string;
    old_price_cents: number;
    new_price_cents: number;
    note: string | null;
    created_at: string;
    reviewed_at: string | null;
    event_title: string;
    event_id: string;
    ticket_type_id: string;
    ticket_type_name: string;
  }>(
    `SELECT pr.id, pr.status, pr.old_price_cents, pr.new_price_cents, pr.note, pr.created_at,
            pr.reviewed_at, e.title AS event_title, e.id AS event_id,
            pr.ticket_type_id, tt.name AS ticket_type_name
     FROM price_requests pr
     JOIN events e ON e.id = pr.event_id
     JOIN ticket_types tt ON tt.id = pr.ticket_type_id
     WHERE pr.requested_by = ?
     ORDER BY pr.created_at DESC`,
    organizerId,
  );
}
