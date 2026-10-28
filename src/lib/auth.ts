import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { all, get, run } from "./db";
import { randomId } from "./format";
import { mfaSatisfied } from "./mfa";
import type { Role, User } from "./types";

const SESSION_COOKIE = "eventiq_session";
const MFA_COOKIE = "eventiq_mfa";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MFA_TTL_SECONDS = 60 * 10;
const LAST_SEEN_INTERVAL_MS = 5 * 60_000;

function sessionSecret() {
  return process.env.SESSION_SECRET || "eventiq-development-secret-change-me";
}

function signingKey() {
  return createHmac("sha256", sessionSecret()).update("eventiq.cookie.v1").digest();
}

function base64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(body: string) {
  return createHmac("sha256", signingKey()).update(body).digest("base64url");
}

function signPayload(payload: unknown) {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifyPayload<T>(token: string): T | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface SessionInfo {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
}

export interface SessionMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Creates a server-side session row and cookie. Only the SHA-256 hash of the
 * token is stored, so a database leak cannot be replayed as a login.
 */
export function createSession(user: Pick<User, "id">, meta: SessionMeta = {}) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const id = randomId("sess_");
  run(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, ip, user_agent, revoked_at, revoked_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    id,
    user.id,
    hashToken(token),
    now.toISOString(),
    now.toISOString(),
    expires.toISOString(),
    meta.ip || null,
    meta.userAgent ? meta.userAgent.slice(0, 250) : null,
  );
  return { id, token, expiresAt: expires.toISOString() };
}

export async function setSessionCookie(user: Pick<User, "id">, meta: SessionMeta = {}) {
  const session = createSession(user, meta);
  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return session;
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function revokeSession(userId: string, sessionId: string, reason = "revoked") {
  const result = run(
    "UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
    new Date().toISOString(),
    reason,
    sessionId,
    userId,
  );
  return Number(result.changes) > 0;
}

export function revokeOtherSessions(userId: string, keepSessionId: string | null, reason = "revoked") {
  const result = keepSessionId
    ? run(
        "UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL",
        new Date().toISOString(),
        reason,
        userId,
        keepSessionId,
      )
    : run(
        "UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL",
        new Date().toISOString(),
        reason,
        userId,
      );
  return Number(result.changes);
}

export function revokeAllSessions(userId: string, reason = "revoked") {
  return revokeOtherSessions(userId, null, reason);
}

export function listSessions(userId: string) {
  return all<SessionInfo>(
    `SELECT id, created_at, last_seen_at, expires_at, ip, user_agent
     FROM sessions
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
     ORDER BY last_seen_at DESC`,
    userId,
    new Date().toISOString(),
  );
}

const sessionContext = cache(async (): Promise<{ user: User; session: SessionRow } | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = get<SessionRow>(
    "SELECT * FROM sessions WHERE token_hash = ?",
    hashToken(token),
  );
  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const user = get<User>("SELECT * FROM users WHERE id = ?", session.user_id);
  if (!user || user.status !== "active") return null;

  const lastSeen = new Date(session.last_seen_at).getTime();
  if (Date.now() - lastSeen > LAST_SEEN_INTERVAL_MS) {
    run("UPDATE sessions SET last_seen_at = ? WHERE id = ?", new Date().toISOString(), session.id);
  }
  return { user, session };
});

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const context = await sessionContext();
  return context?.user ?? null;
});

export async function getCurrentSessionId() {
  const context = await sessionContext();
  return context?.session.id ?? null;
}

export async function destroyCurrentSession(reason = "logout") {
  const context = await sessionContext();
  if (context) {
    run(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ?",
      new Date().toISOString(),
      reason,
      context.session.id,
    );
  }
  await clearSessionCookie();
}

export type ChallengePurpose = "mfa" | "enroll";

interface ChallengePayload {
  uid: string;
  purpose: ChallengePurpose;
  exp: number;
}

/** Short-lived signed cookie used between password verification and MFA. */
export async function setMfaChallenge(userId: string, purpose: ChallengePurpose) {
  const store = await cookies();
  const payload: ChallengePayload = {
    uid: userId,
    purpose,
    exp: Math.floor(Date.now() / 1000) + MFA_TTL_SECONDS,
  };
  store.set(MFA_COOKIE, signPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MFA_TTL_SECONDS,
  });
}

export async function readMfaChallenge(): Promise<ChallengePayload | null> {
  const store = await cookies();
  const token = store.get(MFA_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyPayload<ChallengePayload>(token);
  if (!payload || !payload.uid) return null;
  if (payload.exp * 1000 <= Date.now()) return null;
  if (payload.purpose !== "mfa" && payload.purpose !== "enroll") return null;
  return payload;
}

export async function clearMfaChallenge() {
  const store = await cookies();
  store.delete(MFA_COOKIE);
}

export function canAccess(user: User | null, roles: Role[]) {
  return !!user && roles.includes(user.role);
}

export async function requireUser(roles?: Role[], loginPath = "/login") {
  const user = await getCurrentUser();
  if (!user) redirect(`${loginPath}?next=${encodeURIComponent("/dashboard")}`);
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  if (!mfaSatisfied(user)) redirect("/security?required=1");
  return user;
}

export async function requireRolePage(roles: Role[], loginPath = "/login") {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath);
  if (!roles.includes(user.role)) redirect("/dashboard?denied=1");
  if (!mfaSatisfied(user)) redirect("/security?required=1");
  return user;
}

export function isStaffRole(role: Role) {
  return role === "gate" || role === "admin" || role === "ceo";
}
