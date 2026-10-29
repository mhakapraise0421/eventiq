import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { iqEnabled } from "@/lib/iq/config";
import { searchPublicEvents, toIqSource } from "@/lib/iq/discovery";
import { answerPublicQuestion, IqError } from "@/lib/iq/provider";
import { consumeIqQuota, quotaMessage } from "@/lib/iq/usage";
import {
  IQ_COOKIE,
  IQ_COOKIE_MAX_AGE,
  canAccessConversation,
  countUserTurns,
  createConversation,
  hashVisitorToken,
  latestConversation,
  loadConversation,
  newVisitorToken,
  parseSources,
  recentMessages,
  recordTurn,
} from "@/lib/iq/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 800;
const MAX_TURNS = 12;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IQ_COOKIE_MAX_AGE,
  };
}

function serialize(messages: ReturnType<typeof recentMessages>) {
  return messages.map((entry) => ({
    role: entry.role,
    content: entry.content,
    sources: parseSources(entry.sources_json),
  }));
}

/** Restores the visitor's most recent public conversation, if any. */
export async function GET(request: Request) {
  if (!iqEnabled()) return jsonError("IQ is currently unavailable.", 503);

  const limited = rateLimit(`iq:read:${clientIp(request)}`, 60, 5 * 60_000);
  if (!limited.ok) return jsonError("Too many requests. Please slow down.", 429);

  const store = await cookies();
  const token = store.get(IQ_COOKIE)?.value || null;
  const tokenHash = token ? hashVisitorToken(token) : null;
  const user = await getCurrentUser();
  const requested = new URL(request.url).searchParams.get("conversationId");
  const conversation = requested
    ? loadConversation(requested)
    : latestConversation(user, tokenHash, "public");

  if (
    !conversation ||
    conversation.surface !== "public" ||
    !canAccessConversation(conversation, user, tokenHash)
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

  const body = await readJson<{ conversationId?: string; message?: string }>(request);
  if (!body) return jsonError("Invalid request body.");

  const message = String(body.message || "").trim();
  if (!message) return jsonError("Type a question for IQ.");
  if (message.length > MAX_MESSAGE) {
    return jsonError(`Keep questions under ${MAX_MESSAGE} characters.`, 413);
  }

  const ip = clientIp(request);
  const limited = rateLimit(`iq:ask:${ip}`, 30, 10 * 60_000);
  if (!limited.ok) {
    return jsonError(
      "You've asked IQ a lot in a short time. Please try again in a few minutes.",
      429,
    );
  }

  const store = await cookies();
  let token = store.get(IQ_COOKIE)?.value || null;
  let tokenHash = token ? hashVisitorToken(token) : null;
  const user = await getCurrentUser();

  let conversation = body.conversationId ? loadConversation(body.conversationId) : null;
  if (
    body.conversationId &&
    (!conversation ||
      conversation.surface !== "public" ||
      !canAccessConversation(conversation, user, tokenHash))
  ) {
    return jsonError("That conversation is no longer available. Start a new chat.", 404);
  }

  if (!conversation) {
    if (!user && !token) {
      token = newVisitorToken();
      tokenHash = hashVisitorToken(token);
      store.set(IQ_COOKIE, token, cookieOptions());
    }
    conversation = createConversation({
      user,
      tokenHash: user ? null : tokenHash,
      surface: "public",
    });
  }

  if (countUserTurns(conversation.id) >= MAX_TURNS) {
    return jsonError(
      "This chat has reached its message limit. Start a new conversation and I'll keep helping.",
      409,
      { code: "conversation_full" },
    );
  }

  const quota = consumeIqQuota({ userId: user?.id ?? null, visitorTokenHash: tokenHash, ip });
  if (!quota.ok) {
    return jsonError(quotaMessage(quota), 429, {
      code: "quota_exceeded",
      limit: quota.limit,
      resetAt: quota.resetAt,
    });
  }

  const history = recentMessages(conversation.id, 8).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  const discovery = searchPublicEvents(message);

  let answer;
  try {
    answer = await answerPublicQuestion({
      message,
      history,
      events: discovery.events,
      filters: discovery.filters,
      relaxedKeyword: discovery.relaxedKeyword,
    });
  } catch (error) {
    if (error instanceof IqError) return jsonError(error.message, error.status);
    console.error("[eventiq] IQ request failed:", error instanceof Error ? error.name : "unknown");
    return jsonError("IQ couldn't answer just now. Please try again.", 502);
  }

  // Only attach listing cards when the reply actually draws on them, so an
  // "I can't help with that" answer never looks like a recommendation.
  const sources = answer.grounded ? discovery.events.slice(0, 6).map(toIqSource) : [];

  recordTurn({
    conversationId: conversation.id,
    message,
    reply: answer.text,
    sources,
    provider: answer.provider,
    model: answer.model,
  });

  return NextResponse.json({
    conversationId: conversation.id,
    reply: answer.text,
    sources,
  });
}
