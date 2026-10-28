import { NextResponse } from "next/server";
import {
  getCurrentSessionId,
  getCurrentUser,
  revokeOtherSessions,
  revokeSession,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const body = await readJson<{ action?: "revoke" | "revoke-others"; sessionId?: string }>(request);
  if (!body) return jsonError("Invalid request body.");
  const ip = clientIp(request);
  const currentId = await getCurrentSessionId();

  if (body.action === "revoke") {
    const sessionId = (body.sessionId || "").trim();
    if (!sessionId) return jsonError("Choose a session to revoke.");
    if (sessionId === currentId) {
      return jsonError("Use sign out to end the session you are using.", 400);
    }
    const revoked = revokeSession(user.id, sessionId, "user_revoked");
    if (!revoked) return jsonError("That session was already signed out.", 404);
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "session.revoked",
      entityType: "session",
      entityId: sessionId,
      ip,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "revoke-others") {
    const count = revokeOtherSessions(user.id, currentId, "user_revoked_all");
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "session.revoked_all",
      entityType: "user",
      entityId: user.id,
      ip,
      after: { revoked: count },
    });
    return NextResponse.json({ ok: true, revoked: count });
  }

  return jsonError("Unknown action.", 400);
}
