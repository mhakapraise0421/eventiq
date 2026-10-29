import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentSessionId, getCurrentUser, revokeOtherSessions } from "@/lib/auth";
import { get } from "@/lib/db";
import {
  confirmMfaEnrollment,
  consumeRecoveryCode,
  disableMfa,
  hasConfirmedMfa,
  mfaSetupUrl,
  roleRequiresMfa,
  startMfaEnrollment,
  verifyMfaCode,
} from "@/lib/mfa";
import { verifyPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const body = await readJson<{
    action?: "start" | "confirm" | "disable";
    code?: string;
    password?: string;
  }>(request);
  if (!body) return jsonError("Invalid request body.");
  const ip = clientIp(request);
  const action = body.action;

  if (action === "start") {
    const limited = rateLimit(`mfa-start:${user.id}:${ip}`, 8, 10 * 60_000);
    if (!limited.ok) return jsonError("Too many setup attempts. Please wait and try again.", 429);
    const started = startMfaEnrollment(user.id);
    if (!started.ok) return jsonError(started.error);
    const uri = mfaSetupUrl(started.secret, user.email);
    const qr = await QRCode.toDataURL(uri, {
      margin: 1,
      width: 240,
      color: { dark: "#0b0b12ff", light: "#ffffffff" },
    });
    return NextResponse.json({ ok: true, secret: started.secret, otpauth: uri, qr });
  }

  if (action === "confirm") {
    const limited = rateLimit(`mfa-confirm:${user.id}:${ip}`, 8, 10 * 60_000);
    if (!limited.ok) return jsonError("Too many attempts. Please wait and try again.", 429);
    const result = confirmMfaEnrollment(user.id, (body.code || "").trim());
    if (!result.ok) return jsonError(result.error);
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "auth.mfa_enabled",
      entityType: "user",
      entityId: user.id,
      ip,
    });
    return NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
  }

  if (action === "disable") {
    if (roleRequiresMfa(user.role)) {
      return jsonError(
        "Two-factor authentication is required for your account type and can't be turned off. Use a recovery code if you lose your authenticator, then contact support.",
        403,
      );
    }
    if (!hasConfirmedMfa(user.id)) {
      return jsonError("Two-factor authentication is not enabled on this account.", 400);
    }
    const password = (body.password || "").trim();
    const code = (body.code || "").trim();
    if (!password || !code) {
      return jsonError("Enter your password and a current authenticator or recovery code.");
    }
    const record = get<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = ?",
      user.id,
    );
    if (!record || !verifyPassword(password, record.password_hash)) {
      return jsonError("Your password is incorrect.", 401);
    }
    const valid = verifyMfaCode(user.id, code) || consumeRecoveryCode(user.id, code);
    if (!valid) return jsonError("That code is not valid right now.", 401);

    disableMfa(user.id);
    const revoked = revokeOtherSessions(user.id, await getCurrentSessionId(), "mfa_disabled");
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "auth.mfa_disabled",
      entityType: "user",
      entityId: user.id,
      ip,
      after: { otherSessionsRevoked: revoked },
    });
    return NextResponse.json({ ok: true, otherSessionsRevoked: revoked });
  }

  return jsonError("Unknown action.", 400);
}
