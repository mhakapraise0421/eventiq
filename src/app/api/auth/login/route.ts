import { NextResponse } from "next/server";
import { setMfaChallenge, setSessionCookie } from "@/lib/auth";
import { get } from "@/lib/db";
import { hasConfirmedMfa, roleRequiresMfa } from "@/lib/mfa";
import { verifyPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { homeForRole } from "@/lib/routes";
import type { User } from "@/lib/types";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);

  const body = await readJson<{ email?: string; password?: string; next?: string }>(request);
  if (!body) return jsonError("Invalid request body.");
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) return jsonError("Enter your email and password.");
  const nextPath =
    body.next && body.next.startsWith("/") && !body.next.startsWith("//")
      ? body.next
      : null;
  const withNext = (path: string) =>
    nextPath ? `${path}?next=${encodeURIComponent(nextPath)}` : path;

  const ip = clientIp(request);
  const limited = rateLimit(`login:${ip}:${email}`, 10, 5 * 60_000);
  if (!limited.ok) {
    return jsonError("Too many sign-in attempts. Please wait and try again.", 429);
  }

  const user = get<User>("SELECT * FROM users WHERE email = ?", email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    writeAudit({
      actorId: null,
      actorName: null,
      actorRole: null,
      action: "auth.login_failed",
      entityType: "auth",
      entityId: email || null,
      outcome: "failure",
      ip,
    });
    return jsonError("Incorrect email or password.", 401);
  }
  if (user.status !== "active") {
    return jsonError("This account has been suspended. Contact support.", 403);
  }

  if (hasConfirmedMfa(user.id)) {
    await setMfaChallenge(user.id, "mfa");
    return NextResponse.json({
      ok: true,
      mfaRequired: true,
      redirect: withNext("/login/verify"),
    });
  }

  if (roleRequiresMfa(user.role)) {
    await setMfaChallenge(user.id, "enroll");
    return NextResponse.json({
      ok: true,
      enrollmentRequired: true,
      redirect: withNext("/login/setup"),
    });
  }

  await setSessionCookie(user, { ip, userAgent: request.headers.get("user-agent") });
  writeAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "auth.login",
    entityType: "session",
    entityId: null,
    ip,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
    redirect: homeForRole(user.role),
  });
}
