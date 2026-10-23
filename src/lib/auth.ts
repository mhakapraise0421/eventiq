import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import { get } from "./db";
import type { Role, User } from "./types";

const SESSION_COOKIE = "eventiq_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret() {
  return process.env.SESSION_SECRET || "eventiq-development-secret-change-me";
}

interface SessionPayload {
  uid: string;
  role: Role;
  iat: number;
  exp: number;
}

function base64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

export function signSession(user: Pick<User, "id" | "role">) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: user.id,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.uid || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: Pick<User, "id" | "role">) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = get<User>("SELECT * FROM users WHERE id = ?", payload.uid);
  if (!user || user.status !== "active") return null;
  return user;
});

export function canAccess(user: User | null, roles: Role[]) {
  return !!user && roles.includes(user.role);
}

export async function requireUser(roles?: Role[], loginPath = "/login") {
  const user = await getCurrentUser();
  if (!user) redirect(`${loginPath}?next=${encodeURIComponent("/dashboard")}`);
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

export async function requireRolePage(roles: Role[], loginPath = "/login") {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath);
  if (!roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

export function isStaffRole(role: Role) {
  return role === "gate" || role === "admin" || role === "ceo";
}
