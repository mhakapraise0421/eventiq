import { NextResponse } from "next/server";
import { getCurrentUser, revokeAllSessions } from "@/lib/auth";
import { get } from "@/lib/db";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { setUserStatus, updateUserRole } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { disableMfa, hasConfirmedMfa, mfaSatisfied } from "@/lib/mfa";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["attendee", "organizer", "artist", "gate", "admin", "ceo"];

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }
  if (!mfaSatisfied(user)) {
    return jsonError("Two-factor authentication is required for this action.", 403);
  }

  const body = await readJson<{
    userId?: string;
    role?: Role;
    status?: "active" | "suspended";
    resetMfa?: boolean;
  }>(request);
  if (!body?.userId) return jsonError("Select a user.");
  if (body.userId === user.id) {
    return jsonError("You cannot change your own role or suspend your own account.");
  }

  if (body.resetMfa) {
    const target = get<{ id: string; role: string }>(
      "SELECT id, role FROM users WHERE id = ?",
      body.userId,
    );
    if (!target) return jsonError("That account no longer exists.");
    if (target.role !== "artist") {
      return jsonError("Two-factor reset is only available for artist accounts.", 400);
    }
    if (!hasConfirmedMfa(target.id)) {
      return jsonError("That artist has not finished two-factor setup.", 400);
    }
    disableMfa(target.id);
    const revoked = revokeAllSessions(target.id, "mfa_reset_by_staff");
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "auth.mfa_reset",
      entityType: "user",
      entityId: target.id,
      before: { mfaEnabled: true },
      after: { mfaEnabled: false, sessionsRevoked: revoked },
      ip: clientIp(request),
    });
    return NextResponse.json({ ok: true, sessionsRevoked: revoked });
  }

  if (body.role) {
    if (!ROLES.includes(body.role)) return jsonError("Unknown role.");
    const result = updateUserRole(
      body.userId,
      body.role,
      user,
      request.headers.get("x-forwarded-for"),
    );
    if (!result.ok) return jsonError(result.error);
  }

  if (body.status) {
    if (!["active", "suspended"].includes(body.status)) return jsonError("Unknown status.");
    const result = setUserStatus(
      body.userId,
      body.status,
      user,
      request.headers.get("x-forwarded-for"),
    );
    if (!result.ok) return jsonError(result.error);
  }

  return NextResponse.json({ ok: true });
}
