import { NextResponse } from "next/server";
import { clearMfaChallenge, readMfaChallenge, setSessionCookie } from "@/lib/auth";
import { get } from "@/lib/db";
import { consumeRecoveryCode, verifyMfaCode } from "@/lib/mfa";
import { writeAudit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { homeForRole } from "@/lib/routes";
import type { User } from "@/lib/types";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);

  const challenge = await readMfaChallenge();
  if (!challenge || challenge.purpose !== "mfa") {
    return jsonError("Your sign-in session expired. Please sign in again.", 401);
  }

  const ip = clientIp(request);
  const limited = rateLimit(`mfa-verify:${challenge.uid}:${ip}`, 6, 5 * 60_000);
  if (!limited.ok) {
    return jsonError("Too many verification attempts. Please wait and try again.", 429);
  }

  const body = await readJson<{ code?: string; recoveryCode?: string }>(request);
  if (!body) return jsonError("Invalid request body.");

  const user = get<User>("SELECT * FROM users WHERE id = ?", challenge.uid);
  if (!user || user.status !== "active") {
    await clearMfaChallenge();
    return jsonError("This account cannot sign in right now. Contact support.", 403);
  }

  const recoveryCode = (body.recoveryCode || "").trim();
  const code = (body.code || "").trim();
  const usedRecovery = recoveryCode ? consumeRecoveryCode(user.id, recoveryCode) : false;
  const verified = usedRecovery ? false : verifyMfaCode(user.id, code);

  if (!usedRecovery && !verified) {
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "auth.mfa_failed",
      entityType: "auth",
      entityId: user.id,
      outcome: "failure",
      ip,
    });
    return jsonError(
      recoveryCode
        ? "That recovery code was not recognised or has already been used."
        : "That code is not valid right now. Codes change every 30 seconds.",
      401,
    );
  }

  await clearMfaChallenge();
  await setSessionCookie(user, { ip, userAgent: request.headers.get("user-agent") });
  writeAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: usedRecovery ? "auth.recovery_code_used" : "auth.mfa_verified",
    entityType: "session",
    entityId: user.id,
    ip,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
    redirect: homeForRole(user.role),
    usedRecoveryCode: usedRecovery,
  });
}
