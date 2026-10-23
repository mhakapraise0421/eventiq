import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { get } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import type { User } from "@/lib/types";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);

  const body = await readJson<{ email?: string; password?: string }>(request);
  if (!body) return jsonError("Invalid request body.");
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) return jsonError("Enter your email and password.");

  const limited = rateLimit(`login:${clientIp(request)}:${email}`, 10, 5 * 60_000);
  if (!limited.ok) {
    return jsonError("Too many sign-in attempts. Please wait and try again.", 429);
  }

  const user = get<User>("SELECT * FROM users WHERE email = ?", email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return jsonError("Incorrect email or password.", 401);
  }
  if (user.status !== "active") {
    return jsonError("This account has been suspended. Contact support.", 403);
  }

  await setSessionCookie(user);
  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
    redirect:
      user.role === "organizer"
        ? "/organizer"
        : user.role === "gate"
          ? "/scan"
          : user.role === "admin" || user.role === "ceo"
            ? "/admin"
            : "/dashboard",
  });
}
