import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { randomId } from "@/lib/format";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import type { User } from "@/lib/types";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const limited = rateLimit(`register:${clientIp(request)}`, 6, 10 * 60_000);
  if (!limited.ok) {
    return jsonError("Too many registration attempts. Try again later.", 429);
  }

  const body = await readJson<{
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    city?: string;
  }>(request);
  if (!body) return jsonError("Invalid request body.");

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const phone = (body.phone || "").trim() || null;
  const city = (body.city || "").trim() || null;

  if (name.length < 2) return jsonError("Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Please enter a valid email address.");
  }
  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters.");
  }

  const existing = get<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
  if (existing) {
    return jsonError("An account with this email already exists.", 409);
  }

  const user: User = {
    id: randomId("usr_"),
    email,
    password_hash: hashPassword(password),
    name,
    phone,
    city,
    role: "attendee",
    status: "active",
    created_at: new Date().toISOString(),
  };

  run(
    `INSERT INTO users (id, email, password_hash, name, phone, city, role, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.email,
    user.password_hash,
    user.name,
    user.phone,
    user.city,
    user.role,
    user.status,
    user.created_at,
  );

  await setSessionCookie(user);
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
}
