import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { mfaSatisfied } from "@/lib/mfa";
import { iqEnabled } from "@/lib/iq/config";
import type { WorkspaceSurface } from "@/lib/iq/intent";
import { answerWorkspaceQuestion, IqError } from "@/lib/iq/provider";
import {
  canAccessConversation,
  countUserTurns,
  createConversation,
  latestConversation,
  loadConversation,
  parseSources,
  recentMessages,
  recordTurn,
} from "@/lib/iq/store";
import { consumeIqQuota, quotaMessage } from "@/lib/iq/usage";
import { buildWorkspaceResult } from "@/lib/iq/workspace";
import type { User } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 800;
const MAX_TURNS = 12;

function surfaceForRole(role: User["role"]): WorkspaceSurface | null {
  if (role === "organizer") return "organizer";
  if (role === "artist") return "artist";
  return null;
}

/**
 * Every check here runs on the server. The browser never sends its role, user
 * id or surface; all three come from the verified session.
 */
async function authorize() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: jsonError("Sign in to use the IQ workspace.", 401) } as const;
  }
  const surface = surfaceForRole(user.role);
  if (!surface) {
    return {
      error: jsonError(
        "The IQ workspace is available to organizer and artist accounts. Public discovery works without signing in.",
        403,
      ),
    } as const;
  }
  if (!mfaSatisfied(user)) {
    return {
      error: jsonError(
        "Set up two-factor authentication before using the IQ workspace.",
        403,
        { code: "mfa_required", redirect: "/security?required=1" },
      ),
    } as const;
  }
  return { user, surface } as const;
}

function serialize(messages: ReturnType<typeof recentMessages>) {
  return messages.map((entry) => ({
    role: entry.role,
    content: entry.content,
    sources: parseSources(entry.sources_json),
  }));
}

/** Restores this account's most recent conversation for its own surface. */
export async function GET(request: Request) {
  if (!iqEnabled()) return jsonError("IQ is currently unavailable.", 503);

  const limited = rateLimit(`iq:ws:read:${clientIp(request)}`, 60, 5 * 60_000);
  if (!limited.ok) return jsonError("Too many requests. Please slow down.", 429);

  const auth = await authorize();
  if ("error" in auth) return auth.error;

  const requested = new URL(request.url).searchParams.get("conversationId");
  const conversation = requested
    ? loadConversation(requested)
    : latestConversation(auth.user, null, auth.surface);

  if (
    !conversation ||
    conversation.surface !== auth.surface ||
    !canAccessConversation(conversation, auth.user, null)
  ) {
    return NextResponse.json({ conversationId: null, messages: [] });
  }

  return NextResponse.json({
    conversationId: conversation.id,
    messages: serialize(recentMessages(conversation.id, 24)),
  });
}

export async function POST(request: Request) {
  if (!iqEnabled()) return jsonError("IQ is currently unavailable.", 503);
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);

  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { user, surface } = auth;

  const body = await readJson<{ conversationId?: string; message?: string }>(request);
  if (!body) return jsonError("Invalid request body.");

  const message = String(body.message || "").trim();
  if (!message) return jsonError("Type a question for IQ.");
  if (message.length > MAX_MESSAGE) {
    return jsonError(`Keep questions under ${MAX_MESSAGE} characters.`, 413);
  }

  const limited = rateLimit(`iq:ws:${user.id}`, 30, 10 * 60_000);
  if (!limited.ok) {
    return jsonError(
      "You've asked IQ a lot in a short time. Please try again in a few minutes.",
      429,
    );
  }

  let conversation = body.conversationId ? loadConversation(body.conversationId) : null;
  if (
    body.conversationId &&
    (!conversation ||
      conversation.surface !== surface ||
      !canAccessConversation(conversation, user, null))
  ) {
    return jsonError("That conversation is no longer available. Start a new chat.", 404);
  }

  if (!conversation) {
    conversation = createConversation({ user, tokenHash: null, surface });
  }

  if (countUserTurns(conversation.id) >= MAX_TURNS) {
    return jsonError(
      "This chat has reached its message limit. Start a new conversation and I'll keep helping.",
      409,
      { code: "conversation_full" },
    );
  }

  const quota = consumeIqQuota({ userId: user.id, ip: clientIp(request) });
  if (!quota.ok) {
    return jsonError(quotaMessage(quota), 429, {
      code: "quota_exceeded",
      limit: quota.limit,
      resetAt: quota.resetAt,
    });
  }

  const result = buildWorkspaceResult(user, message);
  const history = recentMessages(conversation.id, 8).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  let answer;
  try {
    answer = await answerWorkspaceQuestion({ surface, message, history, result });
  } catch (error) {
    if (error instanceof IqError) return jsonError(error.message, error.status);
    console.error("[eventiq] IQ workspace request failed:", error instanceof Error ? error.name : "unknown");
    return jsonError("IQ couldn't answer just now. Please try again.", 502);
  }

  recordTurn({
    conversationId: conversation.id,
    message,
    reply: answer.text,
    sources: [],
    provider: answer.provider,
    model: answer.model,
  });

  return NextResponse.json({
    conversationId: conversation.id,
    reply: answer.text,
    grounded: answer.grounded,
    quota: { used: quota.used, limit: quota.limit },
  });
}
