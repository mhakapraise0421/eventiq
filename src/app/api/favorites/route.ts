import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleFavoriteEvent } from "@/lib/attendee";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to save events.", 401);

  const limited = rateLimit(`favorite:${user.id}`, 40, 60_000);
  if (!limited.ok) return jsonError("Too many requests. Please slow down.", 429);

  const body = await readJson<{ eventId?: string }>(request);
  if (!body?.eventId || typeof body.eventId !== "string") {
    return jsonError("Invalid request.");
  }

  try {
    const favorited = toggleFavoriteEvent(user.id, body.eventId);
    return NextResponse.json({ ok: true, favorited });
  } catch {
    return jsonError("Event not found.", 404);
  }
}
