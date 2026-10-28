import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { removeStaffAssignment } from "@/lib/admin";
import { assignStaff } from "@/lib/gate";
import {
  assignDeviceToGate,
  createDevice,
  createGate,
  generatePairingCode,
  revokeDevice,
  setGateStatus,
} from "@/lib/gates";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }
  const ip = clientIp(request);

  const body = await readJson<{
    action?:
      | "assign-device"
      | "assign-staff"
      | "remove-staff"
      | "create-gate"
      | "set-gate-status"
      | "create-device"
      | "pair-device"
      | "revoke-device";
    deviceId?: string;
    eventId?: string | null;
    staffId?: string | null;
    gateId?: string | null;
    userId?: string;
    gateName?: string;
    assignmentId?: string;
    name?: string;
    serial?: string;
    type?: string;
    kind?: string;
    direction?: string;
    openMs?: number;
    status?: string;
  }>(request);
  if (!body?.action) return jsonError("Unknown operation.");

  if (body.action === "create-gate") {
    if (!body.eventId || !body.name) return jsonError("Choose an event and name the gate.");
    const result = createGate(
      {
        eventId: body.eventId,
        name: body.name,
        kind: body.kind,
        direction: body.direction,
        openMs: body.openMs,
      },
      user,
      ip,
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true, gate: result.gate });
  }

  if (body.action === "set-gate-status") {
    if (!body.gateId || !body.status) return jsonError("Select a gate and status.");
    const result = setGateStatus(body.gateId, body.status, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create-device") {
    if (!body.gateId || !body.name || !body.serial) {
      return jsonError("Choose a gate and provide the device name and serial.");
    }
    const result = createDevice(
      {
        name: body.name,
        serial: body.serial,
        type: body.type,
        gateId: body.gateId,
        staffId: body.staffId || null,
      },
      user,
      ip,
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true, deviceId: result.deviceId });
  }

  if (body.action === "pair-device") {
    if (!body.deviceId) return jsonError("Select a device.");
    const result = generatePairingCode(body.deviceId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true, pairing: result.pairing });
  }

  if (body.action === "revoke-device") {
    if (!body.deviceId) return jsonError("Select a device.");
    const result = revokeDevice(body.deviceId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "assign-device") {
    if (!body.deviceId) return jsonError("Select a device.");
    const result = assignDeviceToGate(
      body.deviceId,
      body.gateId || null,
      body.staffId || null,
      user,
      ip,
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "assign-staff") {
    if (!body.eventId || !body.userId) {
      return jsonError("Select an event and a staff member.");
    }
    const id = assignStaff(
      body.eventId,
      body.userId,
      (body.gateName || "Main gate").trim() || "Main gate",
    );
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "staff.assigned",
      entityType: "event_staff",
      entityId: id,
      after: { eventId: body.eventId, userId: body.userId, gate: body.gateName },
      ip,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove-staff") {
    if (!body.assignmentId) return jsonError("Select an assignment.");
    const result = removeStaffAssignment(body.assignmentId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown operation.");
}
