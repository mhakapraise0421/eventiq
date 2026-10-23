import "server-only";
import { all, get, run, transaction } from "./db";
import { randomId } from "./format";
import type { ScanResult, StaffAssignment, Ticket } from "./types";

export interface ScanOutcome {
  result: ScanResult;
  message: string;
  ticket?: {
    code: string;
    holderName: string;
    ticketType: string;
    eventTitle: string;
  };
  scannedAt: string;
}

type ScanActor = {
  id: string;
  name: string;
  role: string;
  gate: string;
  deviceId?: string | null;
};

export function isAssignedToEvent(userId: string, eventId: string) {
  const row = get<{ id: string }>(
    "SELECT id FROM event_staff WHERE user_id = ? AND event_id = ? LIMIT 1",
    userId,
    eventId,
  );
  return !!row;
}

export function getGateAssignment(userId: string, eventId: string) {
  return get<{ gate_name: string }>(
    "SELECT gate_name FROM event_staff WHERE user_id = ? AND event_id = ? ORDER BY created_at LIMIT 1",
    userId,
    eventId,
  );
}

function logScan(opts: {
  ticketId: string | null;
  ticketCode: string;
  eventId: string | null;
  result: ScanResult;
  message: string;
  gate: string;
  actor: ScanActor;
}) {
  run(
    `INSERT INTO scan_events (id, ticket_id, ticket_code, event_id, result, message, gate, scanned_by, scanner_name, device_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomId("scan_"),
    opts.ticketId,
    opts.ticketCode,
    opts.eventId,
    opts.result,
    opts.message,
    opts.gate,
    opts.actor.id,
    opts.actor.name,
    opts.actor.deviceId || null,
    new Date().toISOString(),
  );
}

export function validateScan(opts: {
  code: string;
  eventId: string;
  actor: ScanActor;
  bypassAssignment?: boolean;
}): ScanOutcome {
  const { code, eventId, actor, bypassAssignment } = opts;
  const scannedAt = new Date().toISOString();

  if (!bypassAssignment && actor.role === "gate" && !isAssignedToEvent(actor.id, eventId)) {
    const outcome: ScanOutcome = {
      result: "unauthorised",
      message: "You are not assigned to this event.",
      scannedAt,
    };
    logScan({
      ticketId: null,
      ticketCode: code,
      eventId,
      result: outcome.result,
      message: outcome.message,
      gate: actor.gate,
      actor,
    });
    return outcome;
  }

  const result = transaction((db) => {
    const ticket = db
      .prepare(
        `SELECT t.*, e.title AS event_title, tt.name AS ticket_type_name, o.status AS order_status
         FROM tickets t
         JOIN events e ON e.id = t.event_id
         JOIN ticket_types tt ON tt.id = t.ticket_type_id
         JOIN orders o ON o.id = t.order_id
         WHERE t.code = ?`,
      )
      .get(code) as unknown as
      | (Ticket & {
          event_title: string;
          ticket_type_name: string;
          order_status: string;
        })
      | undefined;

    if (!ticket) {
      return {
        result: "invalid" as ScanResult,
        message: "Ticket not found. Do not admit.",
        ticketId: null,
      };
    }

    const base = {
      code: ticket.code,
      holderName: ticket.holder_name,
      ticketType: ticket.ticket_type_name,
      eventTitle: ticket.event_title,
    };

    if (ticket.event_id !== eventId) {
      return {
        result: "wrong_event" as ScanResult,
        message: `Ticket is for "${ticket.event_title}", not this event.`,
        ticketId: ticket.id,
        ticket: base,
      };
    }

    if (ticket.order_status !== "paid" && ticket.order_status !== "partially_refunded") {
      return {
        result: "not_paid" as ScanResult,
        message: "This ticket's payment is not confirmed.",
        ticketId: ticket.id,
        ticket: base,
      };
    }

    if (ticket.status === "used") {
      return {
        result: "duplicate" as ScanResult,
        message: `Already scanned at ${ticket.used_at}${ticket.used_gate ? ` (${ticket.used_gate})` : ""}.`,
        ticketId: ticket.id,
        ticket: base,
      };
    }

    if (ticket.status === "void") {
      return {
        result: "void" as ScanResult,
        message: "This ticket has been voided or refunded.",
        ticketId: ticket.id,
        ticket: base,
      };
    }

    db.prepare(
      "UPDATE tickets SET status = 'used', used_at = ?, used_gate = ?, used_by = ? WHERE id = ? AND status = 'valid'",
    ).run(scannedAt, actor.gate, actor.id, ticket.id);

    return {
      result: "accepted" as ScanResult,
      message: "Valid ticket — admit.",
      ticketId: ticket.id,
      ticket: base,
    };
  });

  logScan({
    ticketId: result.ticketId,
    ticketCode: code,
    eventId,
    result: result.result,
    message: result.message,
    gate: actor.gate,
    actor,
  });

  return {
    result: result.result,
    message: result.message,
    ticket: "ticket" in result ? result.ticket : undefined,
    scannedAt,
  };
}

export function getScanCounts(eventId: string) {
  const row = get<{
    accepted: number;
    duplicate: number;
    rejected: number;
    total: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN result = 'accepted' THEN 1 ELSE 0 END), 0) AS accepted,
       COALESCE(SUM(CASE WHEN result = 'duplicate' THEN 1 ELSE 0 END), 0) AS duplicate,
       COALESCE(SUM(CASE WHEN result IN ('invalid','wrong_event','not_paid','void','unauthorised') THEN 1 ELSE 0 END), 0) AS rejected,
       COUNT(*) AS total
     FROM scan_events WHERE event_id = ?`,
    eventId,
  ) as { accepted: number; duplicate: number; rejected: number; total: number };

  const admitted = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM tickets WHERE event_id = ? AND status = 'used'",
    eventId,
  );
  const sold = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM tickets WHERE event_id = ?",
    eventId,
  );

  return {
    accepted: Number(row?.accepted || 0),
    duplicate: Number(row?.duplicate || 0),
    rejected: Number(row?.rejected || 0),
    totalScans: Number(row?.total || 0),
    admitted: Number(admitted?.count || 0),
    ticketsIssued: Number(sold?.count || 0),
  };
}

export function getRecentScans(eventId: string, limit = 12) {
  return all<{
    id: string;
    ticket_code: string;
    result: string;
    message: string | null;
    gate: string | null;
    scanner_name: string | null;
    created_at: string;
    holder_name: string | null;
    ticket_type_name: string | null;
  }>(
    `SELECT s.id, s.ticket_code, s.result, s.message, s.gate, s.scanner_name, s.created_at,
            t.holder_name, tt.name AS ticket_type_name
     FROM scan_events s
     LEFT JOIN tickets t ON t.id = s.ticket_id
     LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
     WHERE s.event_id = ?
     ORDER BY s.created_at DESC LIMIT ?`,
    eventId,
    limit,
  );
}

export function getStaffAssignmentsForUser(userId: string) {
  return all<StaffAssignment>(
    `SELECT s.*, e.title AS event_title, e.starts_at AS event_starts_at,
            u.name AS user_name, u.email AS user_email
     FROM event_staff s
     JOIN events e ON e.id = s.event_id
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ?
     ORDER BY e.starts_at DESC`,
    userId,
  );
}

export function getAssignedEventsWithStats(userId: string) {
  const assignments = getStaffAssignmentsForUser(userId);
  return assignments.map((assignment) => ({
    ...assignment,
    stats: getScanCounts(assignment.event_id),
    eventStatus: get<{ status: string }>("SELECT status FROM events WHERE id = ?", assignment.event_id)
      ?.status,
  }));
}

export function getGateStaffOptions() {
  return all<{ id: string; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE role IN ('gate','admin','ceo') AND status = 'active' ORDER BY name",
  );
}

export function assignStaff(eventId: string, userId: string, gateName: string) {
  const existing = get<{ id: string }>(
    "SELECT id FROM event_staff WHERE event_id = ? AND user_id = ? AND gate_name = ?",
    eventId,
    userId,
    gateName,
  );
  if (existing) return existing.id;
  const id = randomId("staff_");
  run(
    "INSERT INTO event_staff (id, event_id, user_id, gate_name, created_at) VALUES (?, ?, ?, ?, ?)",
    id,
    eventId,
    userId,
    gateName,
    new Date().toISOString(),
  );
  return id;
}
