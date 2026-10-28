import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { clearMfaChallenge, readMfaChallenge, setSessionCookie } from "@/lib/auth";
import { get } from "@/lib/db";
import { confirmMfaEnrollment, hasConfirmedMfa, mfaSetupUrl, startMfaEnrollment } from "@/lib/mfa";
import { writeAudit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { homeForRole } from "@/lib/routes";
import type { User } from "@/lib/types";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);

  const challenge = await readMfaChallenge();
  if (!challenge || challenge.purpose !== "enroll") {
    return jsonError("Start signing in again to set up two-factor authentication.", 401);
  }
  const user = get<User>("SELECT * FROM users WHERE id = ?", challenge.uid);
  if (!user || user.status !== "active") {
    await clearMfaChallenge();
    return jsonError("This account cannot sign in right now. Contact support.", 403);
  }
  if (hasConfirmedMfa(user.id)) {
    return jsonError("Two-factor authentication is already enabled for this account.", 400);
  }

  const body = await readJson<{ action?: "start" | "confirm"; code?: string }>(request);
  if (!body) return jsonError("Invalid request body.");
  const action = body.action || "start";
  const ip = clientIp(request);

  if (action === "start") {
    const limited = rateLimit(`mfa-enroll-start:${user.id}:${ip}`, 8, 10 * 60_000);
    if (!limited.ok) {
      return jsonError("Too many setup attempts. Please wait and try again.", 429);
    }
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
    const limited = rateLimit(`mfa-enroll-confirm:${user.id}:${ip}`, 8, 10 * 60_000);
    if (!limited.ok) {
      return jsonError("Too many attempts. Please wait and try again.", 429);
    }
    const result = confirmMfaEnrollment(user.id, (body.code || "").trim());
    if (!result.ok) return jsonError(result.error);

    await clearMfaChallenge();
    await setSessionCookie(user, { ip, userAgent: request.headers.get("user-agent") });
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "auth.mfa_enabled",
      entityType: "user",
      entityId: user.id,
      ip,
    });
    return NextResponse.json({
      ok: true,
      recoveryCodes: result.recoveryCodes,
      redirect: homeForRole(user.role),
    });
  }

  return jsonError("Unknown action.", 400);
}
