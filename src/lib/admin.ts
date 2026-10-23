import "server-only";
import { all, get, run, transaction } from "./db";
import { writeAudit } from "./audit";
import type {
  AuditLog,
  Device,
  OrganizerApplication,
  PriceRequest,
  Role,
  StaffAssignment,
  User,
} from "./types";

export function listOrganizerApplications(status?: string): OrganizerApplication[] {
  if (status && status !== "all") {
    return all<OrganizerApplication>(
      `SELECT op.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM organizer_profiles op JOIN users u ON u.id = op.user_id
       WHERE op.status = ? ORDER BY op.created_at DESC`,
      status,
    );
  }
  return all<OrganizerApplication>(
    `SELECT op.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM organizer_profiles op JOIN users u ON u.id = op.user_id
     ORDER BY CASE op.status WHEN 'pending' THEN 0 WHEN 'requires_modification' THEN 1 ELSE 2 END,
              op.created_at DESC`,
  );
}

export function getOrganizerProfile(userId: string) {
  return get<OrganizerApplication>(
    `SELECT op.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM organizer_profiles op JOIN users u ON u.id = op.user_id WHERE op.user_id = ?`,
    userId,
  );
}

export function listPriceRequests(status?: string): PriceRequest[] {
  const where = status && status !== "all" ? "WHERE pr.status = ?" : "";
  const params = status && status !== "all" ? [status] : [];
  return all<PriceRequest>(
    `SELECT pr.*, e.title AS event_title, tt.name AS ticket_type_name, u.name AS requester_name
     FROM price_requests pr
     JOIN events e ON e.id = pr.event_id
     JOIN ticket_types tt ON tt.id = pr.ticket_type_id
     JOIN users u ON u.id = pr.requested_by
     ${where}
     ORDER BY CASE pr.status WHEN 'pending' THEN 0 ELSE 1 END, pr.created_at DESC`,
    ...params,
  );
}

export function listUsers(): User[] {
  return all<User>("SELECT * FROM users ORDER BY created_at DESC");
}

export function listDevices(): Device[] {
  return all<Device>(
    `SELECT d.*, e.title AS assigned_event_title, u.name AS assigned_staff_name
     FROM devices d
     LEFT JOIN events e ON e.id = d.assigned_event_id
     LEFT JOIN users u ON u.id = d.assigned_staff_id
     ORDER BY d.updated_at DESC`,
  );
}

export function listAllStaffAssignments(): StaffAssignment[] {
  return all<StaffAssignment>(
    `SELECT s.*, e.title AS event_title, e.starts_at AS event_starts_at,
            u.name AS user_name, u.email AS user_email
     FROM event_staff s
     JOIN events e ON e.id = s.event_id
     JOIN users u ON u.id = s.user_id
     ORDER BY e.starts_at DESC, u.name ASC`,
  );
}

export function listAuditLogs(limit = 100): AuditLog[] {
  return all<AuditLog>("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?", limit);
}

export function decideOrganizerApplication(
  userId: string,
  decision: "approved" | "requires_modification" | "rejected",
  note: string,
  actor: User,
  ip?: string | null,
) {
  const before = get<OrganizerApplication>(
    "SELECT * FROM organizer_profiles WHERE user_id = ?",
    userId,
  );
  if (!before) return { ok: false as const, error: "Application not found." };
  const reviewedAt = new Date().toISOString();
  transaction((db) => {
    db.prepare(
      `UPDATE organizer_profiles SET status = ?, decision_note = ?, reviewed_by = ?, reviewed_at = ?
       WHERE user_id = ?`,
    ).run(decision, note || null, actor.id, reviewedAt, userId);
    if (decision === "approved") {
      db.prepare("UPDATE users SET role = 'organizer' WHERE id = ?").run(userId);
    }
    db.prepare(
      "UPDATE events SET status = 'pending' WHERE organizer_id = ? AND status = 'draft' AND ? = 'approved'",
    ).run(userId, decision);
  });
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: `organizer.${decision}`,
    entityType: "organizer",
    entityId: userId,
    before: { status: before.status },
    after: { status: decision, note },
    ip,
  });
  return { ok: true as const };
}

export function decideEvent(
  eventId: string,
  decision: "approved" | "rejected" | "cancelled",
  reason: string,
  actor: User,
  ip?: string | null,
) {
  const before = get<{ status: string; title: string }>(
    "SELECT status, title FROM events WHERE id = ?",
    eventId,
  );
  if (!before) return { ok: false as const, error: "Event not found." };
  const approvedAt = new Date().toISOString();
  run(
    `UPDATE events SET status = ?, approved_by = ?, approved_at = ?, rejection_reason = ? WHERE id = ?`,
    decision,
    decision === "approved" ? actor.id : null,
    decision === "approved" ? approvedAt : null,
    decision === "rejected" ? reason || "Changes required." : null,
    eventId,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: `event.${decision}`,
    entityType: "event",
    entityId: eventId,
    before: { status: before.status, title: before.title },
    after: { status: decision, reason },
    ip,
  });
  return { ok: true as const };
}

export function decidePriceRequest(
  requestId: string,
  decision: "approved" | "rejected",
  note: string,
  actor: User,
  ip?: string | null,
) {
  const request = get<PriceRequest>(
    "SELECT * FROM price_requests WHERE id = ?",
    requestId,
  );
  if (!request) return { ok: false as const, error: "Price request not found." };
  if (request.status !== "pending") {
    return { ok: false as const, error: "This request has already been reviewed." };
  }
  transaction((db) => {
    db.prepare(
      "UPDATE price_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, note = COALESCE(?, note) WHERE id = ?",
    ).run(decision, actor.id, new Date().toISOString(), note || null, requestId);
    if (decision === "approved") {
      db.prepare("UPDATE ticket_types SET price_cents = ? WHERE id = ?").run(
        request.new_price_cents,
        request.ticket_type_id,
      );
    }
  });
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: `price_change.${decision}`,
    entityType: "ticket_type",
    entityId: request.ticket_type_id,
    before: { price_cents: request.old_price_cents, request_status: request.status },
    after: {
      price_cents:
        decision === "approved" ? request.new_price_cents : request.old_price_cents,
      request_status: decision,
    },
    ip,
  });
  return { ok: true as const };
}

export function updateUserRole(userId: string, role: Role, actor: User, ip?: string | null) {
  const before = get<{ role: string; name: string }>(
    "SELECT role, name FROM users WHERE id = ?",
    userId,
  );
  if (!before) return { ok: false as const, error: "User not found." };
  run("UPDATE users SET role = ? WHERE id = ?", role, userId);
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    before: { role: before.role },
    after: { role, name: before.name },
    ip,
  });
  return { ok: true as const };
}

export function setUserStatus(
  userId: string,
  status: "active" | "suspended",
  actor: User,
  ip?: string | null,
) {
  const before = get<{ status: string; name: string }>(
    "SELECT status, name FROM users WHERE id = ?",
    userId,
  );
  if (!before) return { ok: false as const, error: "User not found." };
  run("UPDATE users SET status = ? WHERE id = ?", status, userId);
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: `user.${status === "suspended" ? "suspended" : "reactivated"}`,
    entityType: "user",
    entityId: userId,
    before: { status: before.status },
    after: { status, name: before.name },
    ip,
  });
  return { ok: true as const };
}

export function assignDevice(
  deviceId: string,
  eventId: string | null,
  staffId: string | null,
  actor: User,
  ip?: string | null,
) {
  const before = get<{ assigned_event_id: string | null }>(
    "SELECT assigned_event_id FROM devices WHERE id = ?",
    deviceId,
  );
  if (!before) return { ok: false as const, error: "Device not found." };
  run(
    "UPDATE devices SET assigned_event_id = ?, assigned_staff_id = ?, assigned_at = ?, updated_at = ? WHERE id = ?",
    eventId,
    staffId,
    eventId ? new Date().toISOString() : null,
    new Date().toISOString(),
    deviceId,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "device.assigned",
    entityType: "device",
    entityId: deviceId,
    before: { assigned_event_id: before.assigned_event_id },
    after: { assigned_event_id: eventId, assigned_staff_id: staffId },
    ip,
  });
  return { ok: true as const };
}

export function removeStaffAssignment(
  assignmentId: string,
  actor: User,
  ip?: string | null,
) {
  const before = get<StaffAssignment>(
    `SELECT s.*, e.title AS event_title, e.starts_at AS event_starts_at,
            u.name AS user_name, u.email AS user_email
     FROM event_staff s JOIN events e ON e.id = s.event_id JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    assignmentId,
  );
  if (!before) return { ok: false as const, error: "Assignment not found." };
  run("DELETE FROM event_staff WHERE id = ?", assignmentId);
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "staff.unassigned",
    entityType: "event_staff",
    entityId: assignmentId,
    before: { event: before.event_title, staff: before.user_name, gate: before.gate_name },
    ip,
  });
  return { ok: true as const };
}
