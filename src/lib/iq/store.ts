import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { all, get, run, transaction } from "@/lib/db";
import { randomId } from "@/lib/format";
import type { User } from "@/lib/types";
import type { IqSource } from "./types";

export const IQ_COOKIE = "eventiq_iq";
export const IQ_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ANONYMOUS_RETENTION_DAYS = 30;

export interface IqConversationRow {
  id: string;
  user_id: string | null;
  visitor_token_hash: string | null;
  surface: string;
  title: string | null;
  created_at: string;
  last_message_at: string;
}

export interface IqMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources_json: string | null;
  provider: string | null;
  model: string | null;
  created_at: string;
}

export function newVisitorToken() {
  return randomBytes(24).toString("base64url");
}

export function hashVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function loadConversation(id: string) {
  return get<IqConversationRow>("SELECT * FROM iq_conversations WHERE id = ?", id);
}

/**
 * A conversation belongs either to a signed-in user or to the anonymous
 * browser that holds its token. Knowing the id alone is never enough.
 */
export function canAccessConversation(
  conversation: IqConversationRow,
  user: User | null,
  tokenHash: string | null,
) {
  if (conversation.user_id) return !!user && user.id === conversation.user_id;
  return !!tokenHash && conversation.visitor_token_hash === tokenHash;
}

function pruneAnonymousConversations() {
  const cutoff = new Date(Date.now() - ANONYMOUS_RETENTION_DAYS * 86_400_000).toISOString();
  run("DELETE FROM iq_conversations WHERE user_id IS NULL AND last_message_at < ?", cutoff);
}

export function createConversation(input: {
  user: User | null;
  tokenHash: string | null;
  surface?: string;
}) {
  const id = randomId("iqc_");
  const now = new Date().toISOString();
  run(
    `INSERT INTO iq_conversations (id, user_id, visitor_token_hash, surface, title, created_at, last_message_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    id,
    input.user?.id ?? null,
    input.user ? null : input.tokenHash,
    input.surface || "public",
    now,
    now,
  );
  pruneAnonymousConversations();
  return loadConversation(id) as IqConversationRow;
}

export function latestConversation(
  user: User | null,
  tokenHash: string | null,
  surface = "public",
) {
  if (user) {
    return get<IqConversationRow>(
      "SELECT * FROM iq_conversations WHERE user_id = ? AND surface = ? ORDER BY last_message_at DESC LIMIT 1",
      user.id,
      surface,
    );
  }
  if (!tokenHash) return undefined;
  return get<IqConversationRow>(
    "SELECT * FROM iq_conversations WHERE visitor_token_hash = ? AND user_id IS NULL AND surface = ? ORDER BY last_message_at DESC LIMIT 1",
    tokenHash,
    surface,
  );
}

export function countUserTurns(conversationId: string) {
  const row = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM iq_messages WHERE conversation_id = ? AND role = 'user'",
    conversationId,
  );
  return Number(row?.count || 0);
}

export function recentMessages(conversationId: string, limit = 24): IqMessageRow[] {
  return all<IqMessageRow>(
    "SELECT * FROM iq_messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT ?",
    conversationId,
    limit,
  ).reverse();
}

export function parseSources(json: string | null): IqSource[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as IqSource[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordTurn(input: {
  conversationId: string;
  message: string;
  reply: string;
  sources: IqSource[];
  provider: string;
  model: string;
}) {
  const now = new Date().toISOString();
  const title = input.message.slice(0, 70);
  transaction((db) => {
    const insert = db.prepare(
      `INSERT INTO iq_messages (id, conversation_id, role, content, sources_json, provider, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(randomId("iqm_"), input.conversationId, "user", input.message, null, null, null, now);
    insert.run(
      randomId("iqm_"),
      input.conversationId,
      "assistant",
      input.reply,
      JSON.stringify(input.sources),
      input.provider,
      input.model,
      new Date().toISOString(),
    );
    db.prepare(
      "UPDATE iq_conversations SET last_message_at = ?, title = COALESCE(title, ?) WHERE id = ?",
    ).run(new Date().toISOString(), title, input.conversationId);
  });
}
