import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { all, get, run, transaction } from "./db";
import { randomId } from "./format";
import { writeAudit } from "./audit";
import type {
  Device,
  Gate,
  GateDirection,
  GateKind,
  GateStatus,
  User,
} from "./types";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const GATE_KINDS: GateKind[] = ["turnstile", "overhead", "handheld"];
const GATE_DIRECTIONS: GateDirection[] = ["in", "out", "both"];
const GATE_STATUSES: GateStatus[] = ["active", "maintenance", "closed"];
const DEVICE_TYPES = ["scanner", "gate_controller", "bridge"] as const;

export interface DeviceContext {
  device: Device;
  gate: Gate;
  event: {
    id: string;
    title: string;
    starts_at: string;
    venue: string;
    city: string;
  };
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function asGateKind(value: string | undefined): GateKind {
  return GATE_KINDS.includes(value as GateKind) ? (value as GateKind) : "turnstile";
}

function asGateDirection(value: string | undefined): GateDirection {
  return GATE_DIRECTIONS.includes(value as GateDirection)
    ? (value as GateDirection)
    : "in";
}

function normalizePairingCode(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");
  return cleaned.startsWith("PAIR-") ? cleaned : `PAIR-${cleaned}`;
}

export function listGates(eventId?: string): Gate[] {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const params: string[] = [cutoff];
  const where = eventId ? "WHERE g.event_id = ?" : "";
  if (eventId) params.push(eventId);
  return all<Gate>(
    `SELECT g.*, e.title AS event_title, e.starts_at AS event_starts_at,
            (SELECT COUNT(*) FROM devices d WHERE d.gate_id = g.id) AS device_count,
            (SELECT COUNT(*) FROM devices d WHERE d.gate_id = g.id AND d.api_key_hash IS NOT NULL) AS paired_count,
            (SELECT COUNT(*) FROM devices d WHERE d.gate_id = g.id AND d.last_seen_at >= ?) AS online_count,
            (SELECT MAX(d.last_seen_at) FROM devices d WHERE d.gate_id = g.id) AS last_seen_at
     FROM gates g
     JOIN events e ON e.id = g.event_id
     ${where}
     ORDER BY e.starts_at DESC, g.name ASC`,
    ...params,
  );
}

export function getGate(gateId: string): Gate | undefined {
  return get<Gate>(
    `SELECT g.*, e.title AS event_title, e.starts_at AS event_starts_at
     FROM gates g JOIN events e ON e.id = g.event_id WHERE g.id = ?`,
    gateId,
  );
}

export function createGate(
  input: {
    eventId: string;
    name: string;
    kind?: string;
    direction?: string;
    openMs?: number;
  },
  actor: User,
  ip?: string | null,
) {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (name.length < 2) {
    return { ok: false as const, error: "Give the gate a name of at least 2 characters." };
  }
  const event = get<{ id: string; title: string }>(
    "SELECT id, title FROM events WHERE id = ?",
    input.eventId,
  );
  if (!event) return { ok: false as const, error: "Select a valid event." };

  const duplicate = get<{ id: string }>(
    "SELECT id FROM gates WHERE event_id = ? AND lower(name) = lower(?)",
    input.eventId,
    name,
  );
  if (duplicate) {
    return { ok: false as const, error: "That event already has a gate with this name." };
  }

  const id = randomId("gate_");
  const now = new Date().toISOString();
  const openMs = Math.min(5000, Math.max(200, Math.round(input.openMs || 600)));
  run(
    `INSERT INTO gates (id, event_id, name, kind, direction, status, open_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    id,
    input.eventId,
    name,
    asGateKind(input.kind),
    asGateDirection(input.direction),
    openMs,
    now,
    now,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "gate.created",
    entityType: "gate",
    entityId: id,
    after: { eventId: input.eventId, name, kind: asGateKind(input.kind) },
    ip,
  });
  return { ok: true as const, gate: getGate(id) };
}

export function setGateStatus(
  gateId: string,
  status: string,
  actor: User,
  ip?: string | null,
) {
  if (!GATE_STATUSES.includes(status as GateStatus)) {
    return { ok: false as const, error: "Unknown gate status." };
  }
  const before = getGate(gateId);
  if (!before) return { ok: false as const, error: "Gate not found." };
  run(
    "UPDATE gates SET status = ?, updated_at = ? WHERE id = ?",
    status,
    new Date().toISOString(),
    gateId,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "gate.status_changed",
    entityType: "gate",
    entityId: gateId,
    before: { status: before.status },
    after: { status, name: before.name },
    ip,
  });
  return { ok: true as const };
}

export function createDevice(
  input: {
    name: string;
    serial: string;
    type?: string;
    gateId: string;
    staffId?: string | null;
  },
  actor: User,
  ip?: string | null,
) {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  const serial = input.serial.trim().toUpperCase().slice(0, 64);
  if (name.length < 2) {
    return { ok: false as const, error: "Give the device a name of at least 2 characters." };
  }
  if (serial.length < 3) {
    return { ok: false as const, error: "Enter the device serial number." };
  }
  const gate = getGate(input.gateId);
  if (!gate) return { ok: false as const, error: "Assign the device to a valid gate." };
  const duplicate = get<{ id: string }>(
    "SELECT id FROM devices WHERE upper(serial) = ?",
    serial,
  );
  if (duplicate) {
    return { ok: false as const, error: "A device with this serial already exists." };
  }
  const type = DEVICE_TYPES.includes(input.type as (typeof DEVICE_TYPES)[number])
    ? (input.type as (typeof DEVICE_TYPES)[number])
    : "gate_controller";
  const staffId = input.staffId || null;
  if (staffId) {
    const staff = get<{ id: string }>(
      "SELECT id FROM users WHERE id = ? AND role IN ('gate','admin','ceo') AND status = 'active'",
      staffId,
    );
    if (!staff) return { ok: false as const, error: "Select an active gate staff member." };
  }
  const id = randomId("dev_");
  const now = new Date().toISOString();
  run(
    `INSERT INTO devices (id, name, serial, type, status, assigned_event_id, assigned_staff_id, gate_id, assigned_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    id,
    name,
    serial,
    type,
    gate.event_id,
    staffId,
    gate.id,
    now,
    now,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "device.created",
    entityType: "device",
    entityId: id,
    after: { name, serial, type, gateId: gate.id, eventId: gate.event_id },
    ip,
  });
  return { ok: true as const, deviceId: id };
}

export function assignDeviceToGate(
  deviceId: string,
  gateId: string | null,
  staffId: string | null,
  actor: User,
  ip?: string | null,
) {
  const before = get<Device & { gate_name?: string | null }>(
    `SELECT d.*, g.name AS gate_name FROM devices d
     LEFT JOIN gates g ON g.id = d.gate_id WHERE d.id = ?`,
    deviceId,
  );
  if (!before) return { ok: false as const, error: "Device not found." };

  let eventId: string | null = null;
  let gateName: string | null = null;
  if (gateId) {
    const gate = getGate(gateId);
    if (!gate) return { ok: false as const, error: "Gate not found." };
    eventId = gate.event_id;
    gateName = gate.name;
  }
  if (staffId) {
    const staff = get<{ id: string }>(
      "SELECT id FROM users WHERE id = ? AND role IN ('gate','admin','ceo') AND status = 'active'",
      staffId,
    );
    if (!staff) return { ok: false as const, error: "Select an active gate staff member." };
  }
  const now = new Date().toISOString();
  run(
    `UPDATE devices SET gate_id = ?, assigned_event_id = ?, assigned_staff_id = ?,
            assigned_at = ?, updated_at = ? WHERE id = ?`,
    gateId,
    eventId,
    staffId,
    gateId ? now : null,
    now,
    deviceId,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "device.assigned",
    entityType: "device",
    entityId: deviceId,
    before: { gate_id: before.gate_id, event_id: before.assigned_event_id },
    after: { gate_id: gateId, gate: gateName, event_id: eventId, staff_id: staffId },
    ip,
  });
  return { ok: true as const };
}

export function generatePairingCode(
  deviceId: string,
  actor: User,
  ip?: string | null,
) {
  const device = get<Device & { gate_name: string | null; event_id: string | null }>(
    `SELECT d.*, g.name AS gate_name, g.event_id AS event_id
     FROM devices d LEFT JOIN gates g ON g.id = d.gate_id WHERE d.id = ?`,
    deviceId,
  );
  if (!device) return { ok: false as const, error: "Device not found." };
  if (device.status !== "active") {
    return { ok: false as const, error: "Only active devices can be paired." };
  }
  if (!device.gate_id) {
    return { ok: false as const, error: "Assign the device to a gate before pairing it." };
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS).toISOString();
  const raw = randomBytes(6).toString("hex").toUpperCase();
  const code = `PAIR-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  transaction((db) => {
    db.prepare(
      "UPDATE device_pairings SET used_at = ? WHERE device_id = ? AND used_at IS NULL",
    ).run(now.toISOString(), deviceId);
    db.prepare(
      `INSERT INTO device_pairings (id, device_id, code_hash, expires_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      randomId("pair_"),
      deviceId,
      hashSecret(code),
      expiresAt,
      actor.id,
      now.toISOString(),
    );
  });
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "device.pairing_created",
    entityType: "device",
    entityId: deviceId,
    after: { gateId: device.gate_id, expiresAt, tokenPrefix: device.api_key_prefix },
    ip,
  });
  return {
    ok: true as const,
    pairing: {
      code,
      expiresAt,
      serial: device.serial,
      deviceName: device.name,
      gateName: device.gate_name,
    },
  };
}

export function pairDevice(input: { code: string; serial: string }, ip?: string | null) {
  const code = normalizePairingCode(input.code || "");
  const serial = (input.serial || "").trim().toUpperCase();
  if (!/^PAIR-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code)) {
    return { ok: false as const, error: "Enter the one-time pairing code from EventIQ." };
  }
  if (!serial) {
    return { ok: false as const, error: "Enter the device serial number." };
  }
  const now = new Date().toISOString();
  const row = get<{
    pairing_id: string;
    device_id: string;
    device_name: string;
    device_serial: string;
    device_status: string;
    gate_id: string | null;
    gate_name: string | null;
    gate_kind: string | null;
    gate_direction: string | null;
    gate_status: string | null;
    gate_open_ms: number | null;
    event_id: string | null;
    event_title: string | null;
    event_starts_at: string | null;
    event_venue: string | null;
    event_city: string | null;
  }>(
    `SELECT p.id AS pairing_id, d.id AS device_id, d.name AS device_name,
            d.serial AS device_serial, d.status AS device_status,
            g.id AS gate_id, g.name AS gate_name, g.kind AS gate_kind,
            g.direction AS gate_direction, g.status AS gate_status, g.open_ms AS gate_open_ms,
            e.id AS event_id, e.title AS event_title, e.starts_at AS event_starts_at,
            e.venue AS event_venue, e.city AS event_city
     FROM device_pairings p
     JOIN devices d ON d.id = p.device_id
     LEFT JOIN gates g ON g.id = d.gate_id
     LEFT JOIN events e ON e.id = g.event_id
     WHERE p.code_hash = ? AND p.used_at IS NULL AND p.expires_at > ?
     LIMIT 1`,
    hashSecret(code),
    now,
  );
  if (!row || row.device_serial.toUpperCase() !== serial) {
    return {
      ok: false as const,
      error: "The pairing code or serial number is incorrect, or the code has expired.",
    };
  }
  if (row.device_status !== "active") {
    return { ok: false as const, error: "This device is not active. Ask an administrator." };
  }
  if (!row.gate_id || !row.event_id || row.gate_status !== "active") {
    return { ok: false as const, error: "This device is not assigned to an active gate." };
  }

  const token = `eqd_${randomBytes(32).toString("base64url")}`;
  const tokenPrefix = token.slice(0, 12);
  const paired = transaction((db) => {
    const used = db
      .prepare("UPDATE device_pairings SET used_at = ? WHERE id = ? AND used_at IS NULL")
      .run(now, row.pairing_id);
    if (Number(used.changes) !== 1) return false;
    db.prepare(
      `UPDATE devices SET api_key_hash = ?, api_key_prefix = ?, paired_at = ?,
              assigned_event_id = ?, gate_id = ?, mode = 'online', updated_at = ? WHERE id = ?`,
    ).run(
      hashSecret(token),
      tokenPrefix,
      now,
      row.event_id,
      row.gate_id,
      now,
      row.device_id,
    );
    return true;
  });
  if (!paired) {
    return { ok: false as const, error: "This pairing code was already used. Create a new one." };
  }
  writeAudit({
    actorId: null,
    actorName: row.device_name,
    actorRole: "device",
    action: "device.paired",
    entityType: "device",
    entityId: row.device_id,
    after: { gateId: row.gate_id, eventId: row.event_id, tokenPrefix },
    ip,
  });
  return {
    ok: true as const,
    token,
    device: { id: row.device_id, name: row.device_name, serial: row.device_serial },
    gate: {
      id: row.gate_id,
      name: row.gate_name,
      kind: row.gate_kind,
      direction: row.gate_direction,
      status: row.gate_status,
      openMs: row.gate_open_ms,
    },
    event: {
      id: row.event_id,
      title: row.event_title,
      startsAt: row.event_starts_at,
      venue: row.event_venue,
      city: row.event_city,
    },
    serverTime: now,
  };
}

export function authenticateDeviceRequest(request: Request): DeviceContext | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  if (token.length < 20 || token.length > 200) return null;

  const row = get<
    Device & {
      gate_event_id: string;
      gate_name: string;
      gate_kind: string;
      gate_direction: string;
      gate_status: string;
      gate_open_ms: number;
      gate_created_at: string;
      gate_updated_at: string;
      event_title: string;
      event_starts_at: string;
      event_venue: string;
      event_city: string;
    }
  >(
    `SELECT d.id, d.name, d.serial, d.type, d.status, d.assigned_event_id,
            d.assigned_staff_id, d.gate_id, d.api_key_hash, d.api_key_prefix,
            d.paired_at, d.last_seen_at, d.last_seen_ip, d.firmware, d.mode,
            d.assigned_at, d.updated_at,
            g.event_id AS gate_event_id, g.name AS gate_name, g.kind AS gate_kind,
            g.direction AS gate_direction, g.status AS gate_status,
            g.open_ms AS gate_open_ms, g.created_at AS gate_created_at,
            g.updated_at AS gate_updated_at,
            e.title AS event_title, e.starts_at AS event_starts_at,
            e.venue AS event_venue, e.city AS event_city
     FROM devices d
     JOIN gates g ON g.id = d.gate_id
     JOIN events e ON e.id = g.event_id
     WHERE d.api_key_hash = ?
     LIMIT 1`,
    hashSecret(token),
  );
  if (!row || row.status !== "active") return null;

  return {
    device: row,
    gate: {
      id: row.gate_id as string,
      event_id: row.gate_event_id,
      name: row.gate_name,
      kind: row.gate_kind as GateKind,
      direction: row.gate_direction as GateDirection,
      status: row.gate_status as GateStatus,
      open_ms: row.gate_open_ms,
      created_at: row.gate_created_at,
      updated_at: row.gate_updated_at,
    },
    event: {
      id: row.gate_event_id,
      title: row.event_title,
      starts_at: row.event_starts_at,
      venue: row.event_venue,
      city: row.event_city,
    },
  };
}

export function touchDevice(
  deviceId: string,
  input: {
    ip?: string | null;
    mode?: string | null;
    firmware?: string | null;
  } = {},
) {
  const mode = input.mode === "offline" || input.mode === "online" ? input.mode : null;
  run(
    `UPDATE devices SET last_seen_at = ?, last_seen_ip = ?,
            mode = COALESCE(?, mode), firmware = COALESCE(?, firmware) WHERE id = ?`,
    new Date().toISOString(),
    input.ip || null,
    mode,
    input.firmware ? input.firmware.slice(0, 60) : null,
    deviceId,
  );
}

export function revokeDevice(deviceId: string, actor: User, ip?: string | null) {
  const before = get<Device>("SELECT * FROM devices WHERE id = ?", deviceId);
  if (!before) return { ok: false as const, error: "Device not found." };
  transaction((db) => {
    db.prepare(
      `UPDATE devices SET api_key_hash = NULL, api_key_prefix = NULL, paired_at = NULL,
              mode = 'offline', updated_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), deviceId);
    db.prepare("DELETE FROM device_pairings WHERE device_id = ?").run(deviceId);
  });
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "device.revoked",
    entityType: "device",
    entityId: deviceId,
    before: { tokenPrefix: before.api_key_prefix, gateId: before.gate_id },
    after: { paired: false },
    ip,
  });
  return { ok: true as const };
}
