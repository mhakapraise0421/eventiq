import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { all, get, run, transaction } from "./db";
import { randomId } from "./format";
import { hashPassword, verifyPassword } from "./password";
import { resolveSecret } from "./secrets";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "./totp";
import type { Role, User } from "./types";

export type MfaPolicy = "off" | "staff" | "all" | "custom";

const STAFF_ROLES: Role[] = ["gate", "admin", "ceo"];
const POLICY_TOKENS: Record<string, Role[]> = {
  staff: STAFF_ROLES,
  artists: ["artist"],
  artist: ["artist"],
  organizers: ["organizer"],
  organizer: ["organizer"],
  attendees: ["attendee"],
  attendee: ["attendee"],
};

interface PolicyConfig {
  all: boolean;
  roles: Set<Role>;
  label: MfaPolicy;
  raw: string;
}

/**
 * Two-factor enforcement. Production defaults to staff plus artists, so artist
 * calendars, enquiries and earnings sit behind a second factor. Development
 * stays opt-in so the seeded demo accounts can sign in without setup.
 *
 * MFA_ENFORCEMENT accepts "off", "all", "staff", or a comma-separated role
 * list such as "staff,artists".
 */
function policyConfig(): PolicyConfig {
  const raw = (process.env.MFA_ENFORCEMENT || "").trim().toLowerCase();
  const source = raw || (process.env.NODE_ENV === "production" ? "staff,artists" : "off");
  if (source === "off") return { all: false, roles: new Set(), label: "off", raw: source };
  if (source === "all") return { all: true, roles: new Set(), label: "all", raw: source };
  if (source === "staff") return { all: false, roles: new Set(STAFF_ROLES), label: "staff", raw: source };

  const roles = new Set<Role>();
  for (const token of source.split(/[,\s]+/).filter(Boolean)) {
    for (const role of POLICY_TOKENS[token] || []) roles.add(role);
  }
  if (!roles.size) return { all: false, roles, label: "off", raw: source };
  return { all: false, roles, label: "custom", raw: source };
}

/** Human-readable policy value for the security page. */
export function mfaPolicy(): MfaPolicy {
  return policyConfig().label;
}

/** Raw configured value, shown so operators can see what is enforced. */
export function mfaPolicyValue() {
  const config = policyConfig();
  return config.label === "custom" ? config.raw : config.label;
}

export function roleRequiresMfa(role: Role) {
  const config = policyConfig();
  return config.all || config.roles.has(role);
}

function encryptionKey() {
  return scryptSync(resolveSecret("MFA_ENCRYPTION_KEY", "mfa"), "eventiq-mfa-v1", 32);
}

let cachedKey: Buffer | null = null;
function key() {
  if (!cachedKey) cachedKey = encryptionKey();
  return cachedKey;
}

let cachedLegacyKey: Buffer | null = null;
// Read-only fallback for secrets encrypted by earlier builds, so an upgraded
// deployment never locks an already-enrolled user out of their authenticator.
function legacyKey() {
  if (!cachedLegacyKey) {
    const material =
      process.env.MFA_ENCRYPTION_KEY ||
      process.env.SESSION_SECRET ||
      "eventiq-development-secret-change-me";
    cachedLegacyKey = scryptSync(material, "eventiq-mfa-v1", 32);
  }
  return cachedLegacyKey;
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptWith(encryptionKeyValue: Buffer, payload: string) {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported MFA secret format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKeyValue, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

function decryptSecret(payload: string) {
  try {
    return decryptWith(key(), payload);
  } catch {
    return decryptWith(legacyKey(), payload);
  }
}

interface StoredMfa {
  user_id: string;
  secret_cipher: string;
  confirmed_at: string | null;
  last_used_step: number | null;
  created_at: string;
}

function storedMfa(userId: string) {
  return get<StoredMfa>("SELECT * FROM user_mfa WHERE user_id = ?", userId);
}

export function hasConfirmedMfa(userId: string) {
  const record = get<{ confirmed_at: string | null }>(
    "SELECT confirmed_at FROM user_mfa WHERE user_id = ?",
    userId,
  );
  return !!record?.confirmed_at;
}

export function mfaSatisfied(user: Pick<User, "id" | "role">) {
  if (!roleRequiresMfa(user.role)) return true;
  return hasConfirmedMfa(user.id);
}

export function mfaStatus(userId: string) {
  const record = storedMfa(userId);
  const confirmed = !!record?.confirmed_at;
  const remaining = confirmed
    ? Number(
        get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM user_recovery_codes WHERE user_id = ? AND used_at IS NULL",
          userId,
        )?.count || 0,
      )
    : 0;
  return {
    enabled: confirmed,
    pendingSetup: !!record && !confirmed,
    confirmedAt: record?.confirmed_at || null,
    recoveryCodesRemaining: remaining,
  };
}

function recoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let raw = "";
  for (const byte of bytes) raw += alphabet[byte % alphabet.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function startMfaEnrollment(userId: string) {
  const existing = storedMfa(userId);
  if (existing?.confirmed_at) {
    return { ok: false as const, error: "Two-factor authentication is already enabled." };
  }
  const secret = generateTotpSecret();
  run(
    `INSERT INTO user_mfa (user_id, secret_cipher, confirmed_at, last_used_step, created_at)
     VALUES (?, ?, NULL, NULL, ?)
     ON CONFLICT(user_id) DO UPDATE SET secret_cipher = excluded.secret_cipher,
       confirmed_at = NULL, last_used_step = NULL, created_at = excluded.created_at`,
    userId,
    encryptSecret(secret),
    new Date().toISOString(),
  );
  return { ok: true as const, secret };
}

export function confirmMfaEnrollment(userId: string, code: string) {
  const record = storedMfa(userId);
  if (!record) return { ok: false as const, error: "Start setup again to generate a new key." };
  if (record.confirmed_at) {
    return { ok: false as const, error: "Two-factor authentication is already enabled." };
  }
  let secret: string;
  try {
    secret = decryptSecret(record.secret_cipher);
  } catch {
    return { ok: false as const, error: "The stored setup key could not be read. Start setup again." };
  }
  const step = verifyTotp(secret, code);
  if (step === null) {
    return { ok: false as const, error: "That code did not match. Check your authenticator and try again." };
  }

  const codes = Array.from({ length: 8 }, () => recoveryCode());
  const now = new Date().toISOString();
  transaction((db) => {
    db.prepare("UPDATE user_mfa SET confirmed_at = ?, last_used_step = ? WHERE user_id = ?").run(
      now,
      step,
      userId,
    );
    db.prepare("DELETE FROM user_recovery_codes WHERE user_id = ?").run(userId);
    const insert = db.prepare(
      "INSERT INTO user_recovery_codes (id, user_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)",
    );
    for (const codeValue of codes) {
      insert.run(randomId("rc_"), userId, hashPassword(normalizeRecoveryCode(codeValue)), now);
    }
  });
  return { ok: true as const, recoveryCodes: codes };
}

export function verifyMfaCode(userId: string, code: string) {
  const record = storedMfa(userId);
  if (!record?.confirmed_at) return false;
  const step = verifyTotp(decryptSecret(record.secret_cipher), code);
  if (step === null) return false;
  // Reject replays of a code that already unlocked a session.
  if (record.last_used_step !== null && step <= record.last_used_step) return false;
  run("UPDATE user_mfa SET last_used_step = ? WHERE user_id = ?", step, userId);
  return true;
}

export function consumeRecoveryCode(userId: string, code: string) {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== 12) return false;
  const codes = all<{ id: string; code_hash: string }>(
    "SELECT id, code_hash FROM user_recovery_codes WHERE user_id = ? AND used_at IS NULL",
    userId,
  );
  for (const entry of codes) {
    if (!verifyPassword(normalized, entry.code_hash)) continue;
    const result = run(
      "UPDATE user_recovery_codes SET used_at = ? WHERE id = ? AND used_at IS NULL",
      new Date().toISOString(),
      entry.id,
    );
    return Number(result.changes) > 0;
  }
  return false;
}

export function disableMfa(userId: string) {
  transaction((db) => {
    db.prepare("DELETE FROM user_mfa WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_recovery_codes WHERE user_id = ?").run(userId);
  });
}

export function mfaSetupUrl(secret: string, email: string) {
  return otpauthUrl(secret, email);
}
