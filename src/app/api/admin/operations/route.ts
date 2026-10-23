import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import {
  assignDevice,
  removeStaffAssignment,
} from "@/lib/admin";
import { assignStaff } from "@/lib/gate";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }

  const body = await readJson<{
    action?: "assign-device" | "assign-staff" | "remove-staff";
    deviceId?: string;
    eventId?: string | null;
    staffId?: string | null;
    userId?: string;
    gateName?: string;
    assignmentId?: string;
  }>(request);
  if (!body?.action) return jsonError("Unknown operation.");

  if (body.action === "assign-device") {
    if (!body.deviceId) return jsonError("Select a device.");
    const result = assignDevice(
      body.deviceId,
      body.eventId || null,
      body.staffId || null,
      user,
      request.headers.get("x-forwarded-for"),
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
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove-staff") {
    if (!body.assignmentId) return jsonError("Select an assignment.");
    const result = removeStaffAssignment(
      body.assignmentId,
      user,
      request.headers.get("x-forwarded-for"),
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown operation.");
}
